import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type ComparableTrial,
	compareProductionExperimentTrials,
	type ProductionExperiment,
	productionExperimentConcludeInputSchema,
	productionExperimentCreateInputSchema,
	productionExperimentDetailSchema,
	productionExperimentGetInputSchema,
	productionExperimentLearningInputSchema,
	productionExperimentListInputSchema,
	productionExperimentSchema,
} from "../production-experiments";
import {
	contextProposalSchema,
	narrowestScopeChain,
	sameContextScope,
	validateContextProposal,
} from "../project-context";

function requireStores(context: Context) {
	const { generationPackageStore, productionExperimentStore } = context;
	if (!(generationPackageStore && productionExperimentStore)) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Production Experiment storage is not configured.",
		});
	}
	return { generationPackageStore, productionExperimentStore };
}

function notFound() {
	return new ORPCError("NOT_FOUND", {
		message: "Production Experiment, Asset Record, or project not found.",
	});
}

async function readAssetRecordInputs(
	context: Context,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const { generationPackageStore } = requireStores(context);
	const [assetRecord, packages, catalog] = await Promise.all([
		context.assetRecordStore.get(userId, projectId, assetRecordId),
		generationPackageStore.list(userId, projectId, assetRecordId),
		context.assetVersionStore.list(userId, projectId),
	]);
	if (!(assetRecord && packages && catalog)) {
		throw notFound();
	}
	return { assetRecord, catalog, packages };
}

async function readTrialInputs(
	context: Context,
	userId: string,
	experiment: ProductionExperiment
) {
	const { catalog, packages } = await readAssetRecordInputs(
		context,
		userId,
		experiment.projectId,
		experiment.assetRecordId
	);
	return experiment.trials.map((trial) => {
		const generationPackage = packages.find(
			(entry) => entry.id === trial.generationPackageId
		);
		const candidateVersion = catalog.assetVersions.find(
			(entry) => entry.id === trial.assetVersionId
		);
		if (!(generationPackage && candidateVersion)) {
			throw new ORPCError("CONFLICT", {
				message:
					"A Production Experiment trial lost its pinned Generation Package or Candidate Version.",
			});
		}
		return { candidateVersion, generationPackage, trial };
	});
}

type TrialInput = Awaited<ReturnType<typeof readTrialInputs>>[number];

function compareTrialInputs(inputs: TrialInput[]) {
	const comparable: ComparableTrial[] = inputs.map((entry) => {
		const record = entry.candidateVersion.providerGenerationRecord;
		return {
			generationPackage: entry.generationPackage,
			providerParameters: record
				? {
						interface: record.interface,
						model: record.model,
						modelVersion: record.modelVersion,
						parameters: record.parameterSnapshot.parameters,
						provider: record.provider,
						seed: record.seed,
					}
				: null,
			trialId: entry.trial.id,
		};
	});
	return compareProductionExperimentTrials(comparable);
}

/** A concluded selection must still point at one of the pinned trials. */
function assertSelectedTrialPinned(experiment: ProductionExperiment) {
	const selectedTrialId = experiment.conclusion?.selectedTrialId;
	if (
		selectedTrialId &&
		!experiment.trials.some((trial) => trial.id === selectedTrialId)
	) {
		throw new ORPCError("CONFLICT", {
			message:
				"The selected trial of this Production Experiment is missing from its recorded trials.",
		});
	}
}

export const productionExperimentsRouter = {
	conclude: protectedProcedure
		.input(productionExperimentConcludeInputSchema)
		.output(productionExperimentSchema)
		.handler(async ({ context, input }) => {
			const { productionExperimentStore } = requireStores(context);
			const result = await productionExperimentStore.conclude(
				context.session.user.id,
				{
					experimentId: input.experimentId,
					note: input.note ?? null,
					outcome: input.outcome,
					projectId: input.projectId,
					selectedTrialId: input.selectedTrialId ?? null,
				}
			);
			if (!result) {
				throw notFound();
			}
			if (result.kind === "already-concluded") {
				throw new ORPCError("CONFLICT", {
					message: "This Production Experiment is already concluded.",
				});
			}
			if (result.kind === "trial-changed") {
				throw new ORPCError("CONFLICT", {
					message:
						"The selected trial changed while concluding this Production Experiment; reload and try again.",
				});
			}
			if (result.kind === "trial-not-found") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"The selected trial does not belong to this Production Experiment.",
				});
			}
			return result.experiment;
		}),
	create: protectedProcedure
		.input(productionExperimentCreateInputSchema)
		.output(productionExperimentSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { productionExperimentStore } = requireStores(context);
			const { catalog, packages } = await readAssetRecordInputs(
				context,
				userId,
				input.projectId,
				input.assetRecordId
			);

			const packageIds = new Set(
				input.trials.map((t) => t.generationPackageId)
			);
			const versionIds = new Set(input.trials.map((t) => t.assetVersionId));
			if (
				packageIds.size !== input.trials.length ||
				versionIds.size !== input.trials.length
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Each trial must use its own Generation Package and Candidate Version.",
				});
			}
			for (const trial of input.trials) {
				const ownsPackage = packages.some(
					(entry) =>
						entry.id === trial.generationPackageId &&
						entry.assetRecordId === input.assetRecordId
				);
				const ownsVersion = catalog.assetVersions.some(
					(entry) =>
						entry.id === trial.assetVersionId &&
						entry.assetRecordId === input.assetRecordId
				);
				if (!(ownsPackage && ownsVersion)) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"The Generation Package and Candidate Version must belong to this Asset Record.",
					});
				}
				// The Candidate Version must record this very Generation Package as
				// its production source (manual import evidence).
				const producedFrom = catalog.assetVersions.find(
					(entry) => entry.id === trial.assetVersionId
				)?.productionEvidence?.manualImportEvidence?.generationPackageId;
				if (producedFrom !== trial.generationPackageId) {
					throw new ORPCError("BAD_REQUEST", {
						message: producedFrom
							? `Trial "${trial.label}": the Candidate Version was produced from a different Generation Package than the one chosen for this trial.`
							: `Trial "${trial.label}": the Candidate Version records no Generation Package, so it cannot be paired with this trial.`,
					});
				}
			}

			const experiment = await productionExperimentStore.create(userId, input);
			if (!experiment) {
				throw notFound();
			}
			return experiment;
		}),
	get: protectedProcedure
		.input(productionExperimentGetInputSchema)
		.output(productionExperimentDetailSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { productionExperimentStore } = requireStores(context);
			const experiment = await productionExperimentStore.get(
				userId,
				input.projectId,
				input.experimentId
			);
			if (!experiment) {
				throw notFound();
			}
			assertSelectedTrialPinned(experiment);
			const inputs = await readTrialInputs(context, userId, experiment);
			const comparison = compareTrialInputs(inputs);
			return {
				assetRecordId: experiment.assetRecordId,
				comparison,
				conclusion: experiment.conclusion,
				createdAt: experiment.createdAt,
				id: experiment.id,
				projectId: experiment.projectId,
				title: experiment.title,
				trials: inputs.map((entry) => ({
					...entry.trial,
					candidateVersion: {
						id: entry.candidateVersion.id,
						providerGenerationRecord:
							entry.candidateVersion.providerGenerationRecord ?? null,
						reviewDisposition: entry.candidateVersion.reviewDisposition,
						versionNumber: entry.candidateVersion.versionNumber,
					},
					generationPackage: entry.generationPackage,
				})),
			};
		}),
	list: protectedProcedure
		.input(productionExperimentListInputSchema)
		.output(productionExperimentSchema.array())
		.handler(async ({ context, input }) => {
			const { productionExperimentStore } = requireStores(context);
			const experiments = await productionExperimentStore.list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!experiments) {
				throw notFound();
			}
			return experiments;
		}),
	transferLearning: protectedProcedure
		.input(productionExperimentLearningInputSchema)
		.output(contextProposalSchema)
		.handler(async ({ context, input }) => {
			// Only the signed-in user reaches this procedure and the source is built
			// here, so an agent or automation cannot record this user decision.
			const userId = context.session.user.id;
			const { productionExperimentStore } = requireStores(context);
			const experiment = await productionExperimentStore.get(
				userId,
				input.projectId,
				input.experimentId
			);
			if (!experiment) {
				throw notFound();
			}
			assertSelectedTrialPinned(experiment);
			const { conclusion } = experiment;
			if (!conclusion) {
				throw new ORPCError("CONFLICT", {
					message:
						"A learning can be transferred only from a concluded Production Experiment.",
				});
			}
			const [baseRevision, assetRecord, catalog, trialInputs] =
				await Promise.all([
					context.projectContextStore.getRevision(
						userId,
						input.projectId,
						input.baseContextRevisionId
					),
					context.assetRecordStore.get(
						userId,
						input.projectId,
						experiment.assetRecordId
					),
					context.projectContextScopeStore.list(userId, input.projectId),
					readTrialInputs(context, userId, experiment),
				]);
			if (!(baseRevision && assetRecord && catalog)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Context Revision, Asset Record, or project not found.",
				});
			}

			const chain = narrowestScopeChain(input.projectId, assetRecord, catalog);
			const [narrowestScope] = chain;
			if (!narrowestScope) {
				throw new Error("A Project scope always exists.");
			}
			const changes = input.changes.map((change) => {
				const index = chain.findIndex((scope) =>
					sameContextScope(scope, change.scope)
				);
				const allowed = input.widenScope ? index >= 0 : index === 0;
				if (!allowed) {
					throw new ORPCError("BAD_REQUEST", {
						message: input.widenScope
							? "The scope must be in this Asset Record's scope chain."
							: "The proposal must stay in the narrowest meaningful scope; widening it is the user's decision.",
					});
				}
				return { ...change, precedenceChain: chain.slice(index) };
			});
			const scopeWidenedByUser = changes.some(
				(change) => !sameContextScope(change.scope, narrowestScope)
			);

			const comparison = compareTrialInputs(trialInputs);
			const createdAt = new Date().toISOString();
			const proposal = contextProposalSchema.parse({
				activationAllowed: false,
				baseContextRevisionId: baseRevision.id,
				changes,
				contractVersion: "context-agent/1.0.0",
				createdAt,
				id: crypto.randomUUID(),
				projectId: input.projectId,
				ruleContractVersion: baseRevision.ruleContractVersion,
				source: {
					assetRecordId: experiment.assetRecordId,
					causeCanBeSeparated: comparison.causeCanBeSeparated,
					separability: comparison.separability,
					changedInputs: comparison.changedInputs,
					comment: input.comment,
					comparedTrials: experiment.trials.map((trial) => ({
						assetVersionId: trial.assetVersionId,
						generationPackageId: trial.generationPackageId,
						label: trial.label,
						trialId: trial.id,
					})),
					comparisonStatement: comparison.statement,
					experimentId: experiment.id,
					kind: "production_experiment",
					narrowestScope,
					outcome: conclusion.outcome,
					scopeWidenedByUser,
					selectedTrialId: conclusion.selectedTrialId,
				},
				summary: input.summary,
				validation: validateContextProposal(
					input.projectId,
					baseRevision,
					changes,
					createdAt,
					catalog
				),
			});
			await context.projectContextStore.createProposal(userId, proposal);
			return proposal;
		}),
};
