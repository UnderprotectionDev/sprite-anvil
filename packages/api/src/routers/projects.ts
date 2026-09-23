import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { assertProjectToolAccess } from "../project-access-policy";
import type { ProjectAccessStore } from "../project-access-store";
import { connectionScopes, contextAgentScopes } from "../project-access-store";

const projectNameSchema = z.object({
	name: z.string().trim().min(1).max(80),
});

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
		.input(projectNameSchema)
		.handler(({ context, input }) =>
			context.projectAccess.createProject(context.session.user.id, input.name)
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
		checkContextAgent: protectedProcedure
			.input(checkContextAgentSchema)
			.handler(async ({ context, input }) => {
				await requireOwnedProject(
					context.projectAccess,
					context.session.user.id,
					input.projectId
				);
				await assertProjectToolAccess(context.projectAccess, {
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
				await assertProjectToolAccess(context.projectAccess, {
					principal: "external_connection",
					projectId: input.projectId,
					purpose: input.purpose,
					scope: input.scope,
				});
				return true;
			}),
	},
};
