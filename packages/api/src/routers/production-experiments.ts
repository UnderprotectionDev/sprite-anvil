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
import type { ContextScope } from "../project-context";
import {
	contextProposalSchema,
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
		message: "Üretim Deneyi, Varlık Kaydı veya proje bulunamadı.",
	});
}

async function readTrialInputs(
	context: Context,
	userId: string,
	experiment: ProductionExperiment
) {
	const { generationPackageStore } = requireStores(context);
	const [packages, catalog] = await Promise.all([
		generationPackageStore.list(
			userId,
			experiment.projectId,
			experiment.assetRecordId
		),
		context.assetVersionStore.list(userId, experiment.projectId),
	]);
	if (!(packages && catalog)) {
		throw notFound();
	}
	return experiment.trials.map((trial) => {
		const generationPackage = packages.find(
			(entry) => entry.id === trial.generationPackageId
		);
		const candidateVersion = catalog.assetVersions.find(
			(entry) => entry.id === trial.assetVersionId
		);
		if (!(generationPackage && candidateVersion)) {
			throw new Error(
				"A Production Experiment trial lost its pinned Generation Package or Candidate Version."
			);
		}
		return { candidateVersion, generationPackage, trial };
	});
}

function compareInputs(inputs: Awaited<ReturnType<typeof readTrialInputs>>) {
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

function sameScope(left: ContextScope, right: ContextScope) {
	return left.kind === right.kind && left.id === right.id;
}

/**
 * The narrowest scope the Asset Record is registered under, followed by its
 * wider parents. Asset-level scopes are not registered Project Context scopes
 * yet, so the Theme (else Visual World, else Project) is the narrowest one.
 */
function narrowestScopeChain(
	projectId: string,
	assetRecord: { themeId?: string | null; visualWorldId?: string | null },
	catalog: {
		themes: { id: string; visualWorldId: string }[];
		visualWorlds: { id: string }[];
	}
): ContextScope[] {
	const project: ContextScope = { id: projectId, kind: "project" };
	const theme = assetRecord.themeId
		? catalog.themes.find((entry) => entry.id === assetRecord.themeId)
		: undefined;
	const visualWorldId = theme?.visualWorldId ?? assetRecord.visualWorldId;
	const visualWorld = visualWorldId
		? catalog.visualWorlds.find((entry) => entry.id === visualWorldId)
		: undefined;
	return [
		...(theme ? [{ id: theme.id, kind: "theme" as const }] : []),
		...(visualWorld
			? [{ id: visualWorld.id, kind: "visual_world" as const }]
			: []),
		project,
	];
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
					message: "Bu Üretim Deneyi zaten sonuçlandırıldı.",
				});
			}
			if (result.kind === "trial-not-found") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Seçilen deneme bu Üretim Deneyine ait değil.",
				});
			}
			return result.experiment;
		}),
	create: protectedProcedure
		.input(productionExperimentCreateInputSchema)
		.output(productionExperimentSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { generationPackageStore, productionExperimentStore } =
				requireStores(context);
			const [assetRecord, packages, catalog] = await Promise.all([
				context.assetRecordStore.get(
					userId,
					input.projectId,
					input.assetRecordId
				),
				generationPackageStore.list(
					userId,
					input.projectId,
					input.assetRecordId
				),
				context.assetVersionStore.list(userId, input.projectId),
			]);
			if (!(assetRecord && packages && catalog)) {
				throw notFound();
			}

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
						"Her deneme kendi Üretim Paketini ve Aday Sürümünü kullanmalıdır.",
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
							"Üretim Paketi ve Aday Sürümü bu Varlık Kaydına ait olmalıdır.",
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
			const inputs = await readTrialInputs(context, userId, experiment);
			const comparison = compareInputs(inputs);
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
			const { conclusion } = experiment;
			if (!conclusion) {
				throw new ORPCError("CONFLICT", {
					message:
						"Öğrenim yalnız sonuçlandırılmış bir Üretim Deneyinden aktarılabilir.",
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
					message: "Bağlam Sürümü, Varlık Kaydı veya proje bulunamadı.",
				});
			}

			const chain = narrowestScopeChain(input.projectId, assetRecord, catalog);
			const [narrowestScope] = chain;
			if (!narrowestScope) {
				throw new Error("A Project scope always exists.");
			}
			const changes = input.changes.map((change) => {
				const index = chain.findIndex((scope) =>
					sameScope(scope, change.scope)
				);
				const allowed = input.widenScope ? index >= 0 : index === 0;
				if (!allowed) {
					throw new ORPCError("BAD_REQUEST", {
						message: input.widenScope
							? "Kapsam bu Varlık Kaydının kapsam zincirinde olmalıdır."
							: "Öneri en dar anlamlı kapsamda kalmalıdır; kapsamı genişletmek kullanıcı kararıdır.",
					});
				}
				return { ...change, precedenceChain: chain.slice(index) };
			});
			const scopeWidenedByUser = changes.some(
				(change) => !sameScope(change.scope, narrowestScope)
			);

			const comparison = compareInputs(trialInputs);
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
