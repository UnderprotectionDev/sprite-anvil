import type { RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	projectContextScopeCatalogSchema,
	projectContextScopeListInputSchema,
	themeCreateInputSchema,
	themeRecordSchema,
	visualWorldCreateInputSchema,
	visualWorldRecordSchema,
} from "../context-scopes";
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
	validateContextProposal,
} from "../project-context";
import { assetFamiliesRouter } from "./asset-families";
import { assetVersionsRouter } from "./asset-versions";
import { projectsRouter } from "./projects";

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

export const appRouter = {
	healthCheck: publicProcedure.handler(() => serializeRpcHealthResponse()),
	privateData: protectedProcedure.handler(({ context }) =>
		serializePrivateDataResponse(context.session?.user)
	),
	projects: projectsRouter,
	assetFamilies: assetFamiliesRouter,
	assetVersions: assetVersionsRouter,
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
						message: "Bu Projede aynı adda bir Görsel Dünya zaten var.",
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
							message: "Bu Proje Bağlamı içinde Görsel Dünya bulunamadı.",
						});
					}
					throw new ORPCError("CONFLICT", {
						message: "Bu Görsel Dünya içinde aynı adda bir Tema zaten var.",
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
							"Çakışmalar çözülmeden Bağlam Önerisi etkinleştirilemez.",
					});
				}
				if (review.currentRevisionId !== input.expectedCurrentRevisionId) {
					throw new ORPCError("CONFLICT", {
						message:
							"Etkin Bağlam Sürümü değişti. Etkinleştirmeden önce öneriyi yeniden inceleyin.",
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
							"Etkin Bağlam Sürümü değişti. Etkinleştirmeden önce öneriyi yeniden inceleyin.",
					});
				}
				return revision;
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
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
