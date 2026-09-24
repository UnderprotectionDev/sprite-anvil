import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { isExternalVisualAnalysisProviderPolicyVerified } from "../external-visual-analysis-policy";
import { protectedProcedure } from "../index";
import { assertProjectAccess } from "../project-access-policy";
import type { ProjectAccessStore } from "../project-access-store";
import {
	connectionScopes,
	contextAgentScopes,
	externalVisualAnalysisCategories,
} from "../project-access-store";
import { projectContextCreateInputSchema } from "../project-context";

const projectIdSchema = z.string().min(1).max(200);
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
	create: protectedProcedure
		.input(projectContextCreateInputSchema)
		.handler(({ context, input }) =>
			context.projectAccess.createProject(context.session.user.id, input)
		),
	get: protectedProcedure
		.input(projectIdInputSchema)
		.handler(({ context, input }) =>
			requireOwnedProject(
				context.projectAccess,
				context.session.user.id,
				input.projectId
			)
		),
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
