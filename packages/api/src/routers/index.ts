import type { RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import {
	contextProposalInputSchema,
	contextProposalListInputSchema,
	contextProposalSchema,
	projectContextCreateInputSchema,
	projectContextSchema,
	validateContextProposal,
} from "../project-context";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
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
						createdAt
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
