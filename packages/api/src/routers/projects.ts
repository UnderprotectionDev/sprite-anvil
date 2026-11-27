import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { isExternalVisualAnalysisProviderPolicyVerified } from "../external-visual-analysis-policy";
import { implementProtected, protectedProcedure } from "../index";
import {
	assertAvailableProjectName,
	assertProjectAccess,
} from "../project-access-policy";
import type { ProjectAccessStore } from "../project-access-store";
import {
	connectionScopes,
	contextAgentScopes,
	externalVisualAnalysisCategories,
} from "../project-access-store";
import {
	projectContextCreateInputSchema,
	projectCreateContract,
} from "../project-context";
import {
	projectDeletionApproveInputSchema,
	projectDeletionImpactInputSchema,
	projectDeletionImpactSchema,
	projectDeletionJobSchema,
} from "../project-deletion";

import { projectIdSchema } from "../project-id";

const purposeSchema = z.string().trim().min(3).max(160);

const projectIdInputSchema = z.object({ projectId: projectIdSchema });

const grantContextAgentSchema = z.object({
	projectId: projectIdSchema,
	purpose: purposeSchema,
	scopes: z
		.array(z.enum(contextAgentScopes))
		.min(1)
		.max(contextAgentScopes.length)
		.refine((scopes) => new Set(scopes).size === scopes.length),
});

const revokePermissionSchema = z.object({
	projectId: projectIdSchema,
	permissionId: z.uuid(),
});

const checkContextAgentSchema = z.object({
	projectId: projectIdSchema,
	purpose: purposeSchema,
	scope: z.enum(contextAgentScopes),
});

const checkConnectionSchema = z.object({
	projectId: projectIdSchema,
	purpose: purposeSchema,
	scope: z.enum(connectionScopes),
});

const externalVisualAnalysisPermissionSchema = z.object({
	projectId: projectIdSchema,
	category: z.enum(externalVisualAnalysisCategories),
});

async function requireOwnedProject(
	projectAccess: ProjectAccessStore,
	ownerId: string,
	projectId: string
) {
	const project = await projectAccess.getProject(ownerId, projectId);
	if (!project) {
		throw new ORPCError("NOT_FOUND");
	}
	return project;
}

export const projectsRouter = {
	list: protectedProcedure.handler(({ context }) =>
		context.projectAccess.listProjects(context.session.user.id)
	),
	create: implementProtected({ create: projectCreateContract }).create.handler(
		async ({ context, input }) => {
			const { requestId, ...metadata } = input;
			assertAvailableProjectName(
				await context.projectAccess.listProjects(context.session.user.id),
				metadata.name,
				requestId
			);
			return context.projectAccess.createProject(
				context.session.user.id,
				metadata,
				undefined,
				requestId
			);
		}
	),
	update: protectedProcedure
		.input(
			projectContextCreateInputSchema.extend({ projectId: projectIdSchema })
		)
		.handler(async ({ context, input }) => {
			const { projectId, ...metadata } = input;
			const ownerId = context.session.user.id;
			await requireOwnedProject(context.projectAccess, ownerId, projectId);
			assertAvailableProjectName(
				await context.projectAccess.listProjects(ownerId),
				metadata.name,
				projectId
			);
			if (!context.projectAccess.updateProject) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			const record = await context.projectAccess.updateProject(
				ownerId,
				projectId,
				metadata
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			return record;
		}),
	get: protectedProcedure
		.input(projectIdInputSchema)
		.handler(({ context, input }) =>
			requireOwnedProject(
				context.projectAccess,
				context.session.user.id,
				input.projectId
			)
		),
	deletion: {
		prepare: protectedProcedure
			.input(projectDeletionImpactInputSchema)
			.output(projectDeletionImpactSchema)
			.handler(async ({ context, input }) => {
				if (!context.projectDeletionStore) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Project deletion is unavailable.",
					});
				}
				const impact = await context.projectDeletionStore.prepare(
					context.session.user.id,
					input.projectId
				);
				if (!impact) {
					throw new ORPCError("NOT_FOUND");
				}
				return impact;
			}),
		approve: protectedProcedure
			.input(projectDeletionApproveInputSchema)
			.output(projectDeletionJobSchema)
			.handler(async ({ context, input }) => {
				if (!context.projectDeletionStore) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Project deletion is unavailable.",
					});
				}
				const job = await context.projectDeletionStore.request(
					context.session.user.id,
					input
				);
				if (!job) {
					throw new ORPCError("NOT_FOUND");
				}
				return job;
			}),
		retry: protectedProcedure
			.input(z.object({ jobId: z.string() }))
			.output(projectDeletionJobSchema)
			.handler(async ({ context, input }) => {
				const job = await context.projectDeletionStore?.retry(
					context.session.user.id,
					input.jobId
				);
				if (!job) {
					throw new ORPCError("NOT_FOUND");
				}
				return job;
			}),
		list: protectedProcedure
			.output(z.array(projectDeletionJobSchema))
			.handler(
				({ context }) =>
					context.projectDeletionStore?.list(context.session.user.id) ?? []
			),
		job: protectedProcedure
			.input(projectDeletionImpactInputSchema)
			.output(projectDeletionJobSchema.nullable())
			.handler(({ context, input }) => {
				if (!context.projectDeletionStore) {
					return null;
				}
				return context.projectDeletionStore.read(
					context.session.user.id,
					input.projectId
				);
			}),
	},
	access: {
		list: protectedProcedure
			.input(projectIdInputSchema)
			.handler(async ({ context, input }) => {
				const permissions =
					await context.projectAccess.listContextAgentPermissions(
						context.session.user.id,
						input.projectId
					);
				if (!permissions) {
					throw new ORPCError("NOT_FOUND");
				}
				return permissions;
			}),
		listExternalVisualAnalysis: protectedProcedure
			.input(projectIdInputSchema)
			.handler(async ({ context, input }) => {
				const permissions =
					await context.projectAccess.listExternalVisualAnalysisPermissions(
						context.session.user.id,
						input.projectId
					);
				if (!permissions) {
					throw new ORPCError("NOT_FOUND");
				}
				return permissions;
			}),
		grantContextAgent: protectedProcedure
			.input(grantContextAgentSchema)
			.handler(async ({ context, input }) => {
				const permission =
					await context.projectAccess.grantContextAgentPermission(
						context.session.user.id,
						input.projectId,
						{ purpose: input.purpose, scopes: input.scopes }
					);
				if (!permission) {
					throw new ORPCError("NOT_FOUND");
				}
				return permission;
			}),
		grantExternalVisualAnalysis: protectedProcedure
			.input(externalVisualAnalysisPermissionSchema)
			.handler(async ({ context, input }) => {
				await requireOwnedProject(
					context.projectAccess,
					context.session.user.id,
					input.projectId
				);
				if (!isExternalVisualAnalysisProviderPolicyVerified()) {
					throw new ORPCError("FORBIDDEN");
				}

				const permission =
					await context.projectAccess.grantExternalVisualAnalysisPermission(
						context.session.user.id,
						input.projectId,
						{ category: input.category }
					);
				if (!permission) {
					throw new ORPCError("NOT_FOUND");
				}
				return permission;
			}),
		revoke: protectedProcedure
			.input(revokePermissionSchema)
			.handler(async ({ context, input }) => {
				const revoked =
					await context.projectAccess.revokeContextAgentPermission(
						context.session.user.id,
						input.projectId,
						input.permissionId
					);
				if (!revoked) {
					throw new ORPCError("NOT_FOUND");
				}
				return { revoked: true };
			}),
		revokeExternalVisualAnalysis: protectedProcedure
			.input(revokePermissionSchema)
			.handler(async ({ context, input }) => {
				const revoked =
					await context.projectAccess.revokeExternalVisualAnalysisPermission(
						context.session.user.id,
						input.projectId,
						input.permissionId
					);
				if (!revoked) {
					throw new ORPCError("NOT_FOUND");
				}
				return { revoked: true };
			}),
		checkContextAgent: protectedProcedure
			.input(checkContextAgentSchema)
			.handler(async ({ context, input }) => {
				await requireOwnedProject(
					context.projectAccess,
					context.session.user.id,
					input.projectId
				);
				await assertProjectAccess(context.projectAccess, {
					principal: "context_agent",
					projectId: input.projectId,
					purpose: input.purpose,
					scope: input.scope,
				});
				return true;
			}),
		checkConnection: protectedProcedure
			.input(checkConnectionSchema)
			.handler(async ({ context, input }) => {
				await requireOwnedProject(
					context.projectAccess,
					context.session.user.id,
					input.projectId
				);
				await assertProjectAccess(context.projectAccess, {
					principal: "external_connection",
					projectId: input.projectId,
					purpose: input.purpose,
					scope: input.scope,
				});
				return true;
			}),
		checkExternalVisualAnalysis: protectedProcedure
			.input(externalVisualAnalysisPermissionSchema)
			.handler(async ({ context, input }) => {
				await requireOwnedProject(
					context.projectAccess,
					context.session.user.id,
					input.projectId
				);
				await assertProjectAccess(context.projectAccess, {
					projectId: input.projectId,
					category: input.category,
					type: "external_visual_analysis",
				});
				return true;
			}),
	},
};
