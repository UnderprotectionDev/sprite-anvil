import type { RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { isUniqueViolation } from "@sprite-anvil/db/unique-violation";
import type { Context } from "../context";
import {
	projectContextScopeCatalogSchema,
	projectContextScopeListInputSchema,
	themeCreateInputSchema,
	themeRecordSchema,
	visualWorldCreateInputSchema,
	visualWorldRecordSchema,
} from "../context-scopes";
import { IdempotencyConflictError } from "../idempotency-conflict-error";
import { protectedProcedure, publicProcedure } from "../index";
import {
	serializePrivateDataResponse,
	serializeRpcHealthResponse,
} from "../output-contracts";
import {
	contextProposalActivationInputSchema,
	contextProposalInputSchema,
	contextProposalListInputSchema,
	contextProposalReviewInputSchema,
	contextProposalReviewSchema,
	contextProposalSchema,
	previewContextProposalActivation,
	projectContextCreateInputSchema,
	projectContextSchema,
	styleModuleCopyInputSchema,
	styleModuleCreateInputSchema,
	validateContextProposal,
} from "../project-context";
import { recordContentDigest } from "../record-content-digest";
import { resolveRecordId, withPublicationErrors } from "../record-publication";
import { animationMetadataPackageRouter } from "./animation-metadata-package";
import { animationTimingReviewsRouter } from "./animation-timing-reviews";
import { assetFamiliesRouter } from "./asset-families";
import { assetFamilyComparisonsRouter } from "./asset-family-comparisons";
import { assetRecordTrackingRouter } from "./asset-record-tracking";
import { assetRecordsRouter } from "./asset-records";
import { assetVersionsRouter } from "./asset-versions";
import { backgroundLayerLayoutsRouter } from "./background-layer-layouts";
import { backgroundOperationsRouter } from "./background-operations";
import { backgroundScrollingTestsRouter } from "./background-scrolling-tests";
import { collectionsRouter } from "./collections";
import { deliveryFulfilmentRouter } from "./delivery-fulfilment";
import { deliveryPlanningRouter } from "./delivery-planning";
import { deliveryRefreshLocksRouter } from "./delivery-refresh-locks";
import { dependencyRevalidationRouter } from "./dependency-revalidation";
import { directionalReviewsRouter } from "./directional-reviews";
import { exportBundlesRouter } from "./export-bundles";
import { exportProfilesRouter } from "./export-profiles";
import { familyReadinessRouter } from "./family-readiness";
import { gameplayMetadataRouter } from "./gameplay-metadata";
import { generationPackagesRouter } from "./generation-packages";
import { historicalRiskNoticesRouter } from "./historical-risk-notices";
import { iconFamilyReviewsRouter } from "./icon-family-reviews";
import { importsRouter } from "./imports";
import { marketingUsageReviewsRouter } from "./marketing-usage-reviews";
import { measurementDefinitionsRouter } from "./measurement-definitions";
import { measurementEventsRouter } from "./measurement-events";
import { measurementMeasuresRouter } from "./measurement-measures";
import { permanentErasureRouter } from "./permanent-erasure";
import { platformEquivalenceRouter } from "./platform-equivalence";
import { portraitIdentityReviewsRouter } from "./portrait-identity-reviews";
import { productionExperimentsRouter } from "./production-experiments";
import { productionRecipesRouter } from "./production-recipes";
import { projectArchivesRouter } from "./project-archives";
import { projectsRouter } from "./projects";
import { readinessPlansRouter } from "./readiness-plans";
import { referenceProductionRouter } from "./reference-production";
import { rightsRecordsRouter } from "./rights-records";
import { runtimeValidationRouter } from "./runtime-validation";
import { sceneQaRouter } from "./scene-qa";
import { specializedProfileContractsRouter } from "./specialized-profile-contracts";
import { textureRepetitionReviewsRouter } from "./texture-repetition-reviews";
import { tilesetAdjacencyReviewsRouter } from "./tileset-adjacency-reviews";
import { uiStateComparisonsRouter } from "./ui-state-comparisons";
import { uiStretchTestsRouter } from "./ui-stretch-tests";
import { vfxAppearanceReviewsRouter } from "./vfx-appearance-reviews";
import { vfxSynchronizationRouter } from "./vfx-synchronization";

async function createStyleProposal(
	context: Context,
	projectId: string,
	base: import("../project-context").ContextRevision,
	summary: string,
	changes: import("../project-context").ContextRuleChange[],
	id: string,
	keyed: boolean
) {
	const userId = context.session?.user.id;
	if (!userId) {
		throw new ORPCError("UNAUTHORIZED");
	}
	const catalog = await context.projectContextScopeStore.list(
		userId,
		projectId
	);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Project Context not found" });
	}
	const createdAt = new Date().toISOString();
	const proposal = contextProposalSchema.parse({
		id,
		projectId,
		baseContextRevisionId: base.id,
		contractVersion: "context-agent/1.0.0",
		ruleContractVersion: base.ruleContractVersion,
		summary,
		source: {
			kind: "structured_control",
			controlId: "context-proposal-form",
			controlVersion: "1.0.0",
		},
		changes,
		validation: validateContextProposal(
			projectId,
			base,
			changes,
			createdAt,
			catalog
		),
		activationAllowed: false,
		createdAt,
	});
	const replay = async () => {
		const existing = await context.projectContextStore.getProposal(
			userId,
			projectId,
			id
		);
		if (!existing) {
			return null;
		}
		const payload = (value: typeof proposal) => ({
			baseContextRevisionId: value.baseContextRevisionId,
			changes: value.changes,
			contractVersion: value.contractVersion,
			ruleContractVersion: value.ruleContractVersion,
			source: value.source,
			summary: value.summary,
		});
		if (
			(await recordContentDigest(payload(existing))) !==
			(await recordContentDigest(payload(proposal)))
		) {
			throw new IdempotencyConflictError("Context Proposal");
		}
		return existing;
	};
	return withPublicationErrors(async () => {
		if (keyed) {
			const existing = await replay();
			if (existing) {
				return existing;
			}
		}
		try {
			await context.projectContextStore.createProposal(userId, proposal);
		} catch (error) {
			if (keyed && isUniqueViolation(error)) {
				const existing = await replay();
				if (existing) {
					return existing;
				}
			}
			throw error;
		}
		return proposal;
	});
}

async function readContextProposalReview(
	context: Context,
	projectId: string,
	proposalId: string
) {
	const userId = context.session?.user.id;
	if (!userId) {
		throw new ORPCError("UNAUTHORIZED");
	}
	const proposal = await context.projectContextStore.getProposal(
		userId,
		projectId,
		proposalId
	);
	if (!proposal) {
		throw new ORPCError("NOT_FOUND", { message: "Context Proposal not found" });
	}
	const [baseRevision, project, activatedRevision, scopeCatalog] =
		await Promise.all([
			context.projectContextStore.getRevision(
				userId,
				projectId,
				proposal.baseContextRevisionId
			),
			context.projectContextStore
				.listProjects(userId)
				.then((projects) => projects.find((entry) => entry.id === projectId)),
			context.projectContextStore.getRevisionByProposal(
				userId,
				projectId,
				proposalId
			),
			context.projectContextScopeStore.list(userId, projectId),
		]);
	if (!(baseRevision && project && scopeCatalog)) {
		throw new ORPCError("NOT_FOUND", { message: "Project Context not found" });
	}
	const knownProposalIds = new Set(
		(await context.projectContextStore.listProposals(userId, projectId)).map(
			(entry) => entry.id
		)
	);
	return contextProposalReviewSchema.parse(
		previewContextProposalActivation(
			proposal,
			baseRevision,
			project.currentContextRevision,
			knownProposalIds,
			new Date().toISOString(),
			activatedRevision,
			scopeCatalog
		)
	);
}

const featureRouters = {
	sceneQa: sceneQaRouter,
	uiStretchTests: uiStretchTestsRouter,
	uiStateComparisons: uiStateComparisonsRouter,
	textureRepetitionReviews: textureRepetitionReviewsRouter,
	tilesetAdjacencyReviews: tilesetAdjacencyReviewsRouter,
	healthCheck: publicProcedure.handler(() => serializeRpcHealthResponse()),
	privateData: protectedProcedure.handler(({ context }) =>
		serializePrivateDataResponse(context.session?.user)
	),
	projects: projectsRouter,
	assetFamilies: assetFamiliesRouter,
	assetFamilyComparisons: assetFamilyComparisonsRouter,
	deliveryFulfilment: deliveryFulfilmentRouter,
	historicalRiskNotices: historicalRiskNoticesRouter,
	deliveryPlanning: deliveryPlanningRouter,
	deliveryRefreshLocks: deliveryRefreshLocksRouter,
	exportBundles: exportBundlesRouter,
	permanentErasure: permanentErasureRouter,
	platformEquivalence: platformEquivalenceRouter,
	projectArchives: projectArchivesRouter,
	exportProfiles: exportProfilesRouter,
	dependencyRevalidation: dependencyRevalidationRouter,
	familyReadiness: familyReadinessRouter,
	directionalReviews: directionalReviewsRouter,
	vfxAppearanceReviews: vfxAppearanceReviewsRouter,
	animationTimingReviews: animationTimingReviewsRouter,
	vfxSynchronization: vfxSynchronizationRouter,
	iconFamilyReviews: iconFamilyReviewsRouter,
	portraitIdentityReviews: portraitIdentityReviewsRouter,
	readinessPlans: readinessPlansRouter,
	marketingUsageReviews: marketingUsageReviewsRouter,
	measurementDefinitions: measurementDefinitionsRouter,
	measurementEvents: measurementEventsRouter,
	measurementMeasures: measurementMeasuresRouter,
	backgroundLayerLayouts: backgroundLayerLayoutsRouter,
	backgroundScrollingTests: backgroundScrollingTestsRouter,
	assetVersions: assetVersionsRouter,
	assetRecords: assetRecordsRouter,
	backgroundOperations: backgroundOperationsRouter,
	collections: collectionsRouter,
	animationMetadataPackage: animationMetadataPackageRouter,
	generationPackages: generationPackagesRouter,
	productionExperiments: productionExperimentsRouter,
	productionRecipes: productionRecipesRouter,
	gameplayMetadata: gameplayMetadataRouter,
	assetRecordTracking: assetRecordTrackingRouter,
	imports: importsRouter,
	referenceProduction: referenceProductionRouter,
	rightsRecords: rightsRecordsRouter,
	runtimeValidation: runtimeValidationRouter,
	specializedProfileContracts: specializedProfileContractsRouter,
};

const contextRouters = {
	contextScopes: {
		list: protectedProcedure
			.input(projectContextScopeListInputSchema)
			.output(projectContextScopeCatalogSchema)
			.handler(async ({ context, input }) => {
				const catalog = await context.projectContextScopeStore.list(
					context.session.user.id,
					input.projectId
				);
				if (!catalog) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Context not found",
					});
				}
				return projectContextScopeCatalogSchema.parse(catalog);
			}),
		createVisualWorld: protectedProcedure
			.input(visualWorldCreateInputSchema)
			.output(visualWorldRecordSchema)
			.handler(async ({ context, input }) => {
				const visualWorld =
					await context.projectContextScopeStore.createVisualWorld(
						context.session.user.id,
						input
					);
				if (!visualWorld) {
					const catalog = await context.projectContextScopeStore.list(
						context.session.user.id,
						input.projectId
					);
					if (!catalog) {
						throw new ORPCError("NOT_FOUND", {
							message: "Project Context not found",
						});
					}
					throw new ORPCError("CONFLICT", {
						message:
							"A Visual World with this name already exists in this Project.",
					});
				}
				return visualWorldRecordSchema.parse(visualWorld);
			}),
		createTheme: protectedProcedure
			.input(themeCreateInputSchema)
			.output(themeRecordSchema)
			.handler(async ({ context, input }) => {
				const theme = await context.projectContextScopeStore.createTheme(
					context.session.user.id,
					input
				);
				if (!theme) {
					const catalog = await context.projectContextScopeStore.list(
						context.session.user.id,
						input.projectId
					);
					if (!catalog) {
						throw new ORPCError("NOT_FOUND", {
							message: "Project Context not found",
						});
					}
					if (
						!catalog.visualWorlds.some(
							(visualWorld) => visualWorld.id === input.visualWorldId
						)
					) {
						throw new ORPCError("NOT_FOUND", {
							message: "Visual World not found in this Project Context.",
						});
					}
					throw new ORPCError("CONFLICT", {
						message:
							"A Theme with this name already exists in this Visual World.",
					});
				}
				return themeRecordSchema.parse(theme);
			}),
	},
	projectContexts: {
		list: protectedProcedure.handler(async ({ context }) =>
			Promise.all(
				(
					await context.projectContextStore.listProjects(
						context.session.user.id
					)
				).map((project) => projectContextSchema.parse(project))
			)
		),
		create: protectedProcedure
			.input(projectContextCreateInputSchema)
			.handler(async ({ context, input }) =>
				projectContextSchema.parse(
					await context.projectContextStore.createProject(
						context.session.user.id,
						input
					)
				)
			),
	},
	contextProposals: {
		list: protectedProcedure
			.input(contextProposalListInputSchema)
			.handler(async ({ context, input }) => {
				const ownedProject = (
					await context.projectContextStore.listProjects(
						context.session.user.id
					)
				).some((project) => project.id === input.projectId);
				if (!ownedProject) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Context not found",
					});
				}
				return (
					await context.projectContextStore.listProposals(
						context.session.user.id,
						input.projectId
					)
				).map((proposal) => contextProposalSchema.parse(proposal));
			}),
		review: protectedProcedure
			.input(contextProposalReviewInputSchema)
			.handler(async ({ context, input }) =>
				readContextProposalReview(context, input.projectId, input.proposalId)
			),
		activate: protectedProcedure
			.input(contextProposalActivationInputSchema)
			.handler(async ({ context, input }) => {
				const review = await readContextProposalReview(
					context,
					input.projectId,
					input.proposalId
				);
				if (!review.activationAllowed) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							review.conflicts[0]?.message ??
							"Resolve conflicts before activating the Context Proposal.",
					});
				}
				if (review.currentRevisionId !== input.expectedCurrentRevisionId) {
					throw new ORPCError("CONFLICT", {
						message:
							"The active Context Revision changed. Review the proposal again before activation.",
					});
				}
				const revision = await context.projectContextStore.activateProposal({
					userId: context.session.user.id,
					projectId: input.projectId,
					proposalId: input.proposalId,
					expectedCurrentRevisionId: input.expectedCurrentRevisionId,
					ruleContractVersion: "context-rule/1.0.0",
					rules: review.candidateRules,
				});
				if (!revision) {
					throw new ORPCError("CONFLICT", {
						message:
							"The active Context Revision changed. Review the proposal again before activation.",
					});
				}
				return revision;
			}),
		createStyleModule: protectedProcedure
			.input(styleModuleCreateInputSchema)
			.handler(async ({ context, input }) => {
				const userId = context.session.user.id;
				const recordScope = {
					kind: "style-module-create",
					projectId: input.projectId,
					userId,
				};
				const proposalId = await resolveRecordId(
					recordScope,
					input.idempotencyKey
				);
				const moduleId = await resolveRecordId(
					{ ...recordScope, kind: "style-module-create-module" },
					input.idempotencyKey
				);
				const base = await context.projectContextStore.getRevision(
					userId,
					input.projectId,
					input.baseContextRevisionId
				);
				if (!base) {
					throw new ORPCError("NOT_FOUND", {
						message: "Base Context Revision not found",
					});
				}
				const module = {
					id: moduleId,
					name: input.name,
					version: 1,
				};
				const rules = input.rules.map(({ ruleId, scope }) =>
					base.rules.find(
						(rule) =>
							rule.id === ruleId &&
							rule.scope.kind === scope.kind &&
							rule.scope.id === scope.id
					)
				);
				if (
					rules.some(
						(rule) =>
							!rule ||
							rule.styleModule ||
							rule.scope.kind !== rules[0]?.scope.kind ||
							rule.scope.id !== rules[0]?.scope.id
					) ||
					new Set(
						input.rules.map(
							(rule) => `${rule.scope.kind}:${rule.scope.id}:${rule.ruleId}`
						)
					).size !== input.rules.length
				) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Select existing rules that do not already belong to a Style Module.",
					});
				}
				const changes = rules.flatMap((rule) =>
					rule
						? [
								{
									operation: "replace" as const,
									ruleId: rule.id,
									scope: rule.scope,
									value: rule.value,
									precedenceChain: rule.precedenceChain,
									supersedesRuleId: rule.supersedesRuleId,
									rationale: rule.rationale,
									styleModule: module,
									evidence: [
										{
											kind: "user_decision" as const,
											statement: "Group these rules into a Style Module.",
										},
									],
								},
							]
						: []
				);
				return createStyleProposal(
					context,
					input.projectId,
					base,
					`Style Module: ${input.name}`,
					changes,
					proposalId,
					Boolean(input.idempotencyKey)
				);
			}),
		copyStyleModule: protectedProcedure
			.input(styleModuleCopyInputSchema)
			.handler(async ({ context, input }) => {
				const userId = context.session.user.id;
				const recordScope = {
					kind: "style-module-copy",
					projectId: input.projectId,
					userId,
				};
				const proposalId = await resolveRecordId(
					recordScope,
					input.idempotencyKey
				);
				const moduleId = await resolveRecordId(
					{ ...recordScope, kind: "style-module-copy-module" },
					input.idempotencyKey
				);
				if (input.sourceProjectId === input.projectId) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Choose another project.",
					});
				}
				const [source, base] = await Promise.all([
					context.projectContextStore.getRevision(
						userId,
						input.sourceProjectId,
						input.sourceRevisionId
					),
					context.projectContextStore.getRevision(
						userId,
						input.projectId,
						input.baseContextRevisionId
					),
				]);
				if (!(source && base)) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Context not found",
					});
				}
				const rules = source.rules.filter(
					(rule) => rule.styleModule?.id === input.moduleId
				);
				if (!(rules.length && rules[0]?.styleModule)) {
					throw new ORPCError("NOT_FOUND", {
						message: "Style Module not found",
					});
				}
				const module = {
					id: moduleId,
					name: rules[0].styleModule.name,
					version: 1,
				};
				const targetScope = { kind: "project" as const, id: input.projectId };
				const changes = rules.map((rule) => ({
					operation: "add" as const,
					ruleId: rule.id,
					scope: targetScope,
					value: rule.value,
					rationale: rule.rationale,
					styleModule: module,
					evidence: [
						{
							kind: "user_decision" as const,
							statement: `Copy Style Module from ${input.sourceProjectId}.`,
						},
					],
				}));
				return createStyleProposal(
					context,
					input.projectId,
					base,
					`Copy Style Module: ${module.name}`,
					changes,
					proposalId,
					Boolean(input.idempotencyKey)
				);
			}),
		create: protectedProcedure
			.input(contextProposalInputSchema)
			.handler(async ({ context, input }) => {
				const baseRevision = await context.projectContextStore.getRevision(
					context.session.user.id,
					input.projectId,
					input.baseContextRevisionId
				);
				if (!baseRevision) {
					throw new ORPCError("NOT_FOUND", {
						message: "Base Context Revision not found",
					});
				}
				const scopeCatalog = await context.projectContextScopeStore.list(
					context.session.user.id,
					input.projectId
				);
				if (!scopeCatalog) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Context not found",
					});
				}

				const createdAt = new Date().toISOString();
				const proposal = contextProposalSchema.parse({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					baseContextRevisionId: baseRevision.id,
					contractVersion: "context-agent/1.0.0",
					ruleContractVersion: baseRevision.ruleContractVersion,
					summary: input.summary,
					source: {
						kind: "structured_control",
						controlId: "context-proposal-form",
						controlVersion: "1.0.0",
					},
					changes: input.changes,
					validation: validateContextProposal(
						input.projectId,
						baseRevision,
						input.changes,
						createdAt,
						scopeCatalog
					),
					activationAllowed: false,
					createdAt,
				});

				await context.projectContextStore.createProposal(
					context.session.user.id,
					proposal
				);
				return proposal;
			}),
	},
};
export const appRouter: typeof featureRouters & typeof contextRouters = {
	...featureRouters,
	...contextRouters,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
