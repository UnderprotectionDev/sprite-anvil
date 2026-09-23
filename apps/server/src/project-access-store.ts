import type {
	ContextAgentScope,
	ProjectAccessStore,
	ProjectRecord,
	ToolAccessPermission,
} from "@sprite-anvil/api/project-access-store";
import { contextAgentScopes } from "@sprite-anvil/api/project-access-store";
import type { Database } from "@sprite-anvil/db";
import {
	project,
	toolAccessPermission,
} from "@sprite-anvil/db/schema/project-access";
import { and, desc, eq, isNull } from "drizzle-orm";

function toProjectRecord(record: typeof project.$inferSelect): ProjectRecord {
	return {
		createdAt: record.createdAt.toISOString(),
		id: record.id,
		name: record.name,
	};
}

function isContextAgentScope(scope: string): scope is ContextAgentScope {
	return contextAgentScopes.some((candidate) => candidate === scope);
}

function toToolAccessPermission(
	record: typeof toolAccessPermission.$inferSelect
): ToolAccessPermission {
	if (record.principal !== "context_agent") {
		throw new Error("Unsupported project tool permission principal");
	}
	if (!record.scopes.every(isContextAgentScope)) {
		throw new Error("Unsupported Context Agent permission scope");
	}

	return {
		createdAt: record.createdAt.toISOString(),
		id: record.id,
		principal: record.principal,
		projectId: record.projectId,
		purpose: record.purpose,
		revokedAt: record.revokedAt?.toISOString() ?? null,
		scopes: record.scopes,
	};
}

export function createProjectAccessStore(db: Database): ProjectAccessStore {
	async function getOwnedProject(ownerId: string, projectId: string) {
		const [record] = await db
			.select()
			.from(project)
			.where(and(eq(project.ownerId, ownerId), eq(project.id, projectId)))
			.limit(1);
		return record ?? null;
	}

	return {
		async createProject(ownerId, name) {
			const [record] = await db
				.insert(project)
				.values({ id: crypto.randomUUID(), name, ownerId })
				.returning();
			if (!record) {
				throw new Error("Project could not be created");
			}
			return toProjectRecord(record);
		},
		async getProject(ownerId, projectId) {
			const record = await getOwnedProject(ownerId, projectId);
			return record ? toProjectRecord(record) : null;
		},
		async listProjects(ownerId) {
			const records = await db
				.select()
				.from(project)
				.where(eq(project.ownerId, ownerId))
				.orderBy(desc(project.createdAt));
			return records.map(toProjectRecord);
		},
		async listContextAgentPermissions(ownerId, projectId) {
			const ownedProject = await getOwnedProject(ownerId, projectId);
			if (!ownedProject) {
				return null;
			}
			const records = await db
				.select()
				.from(toolAccessPermission)
				.where(
					and(
						eq(toolAccessPermission.projectId, projectId),
						eq(toolAccessPermission.principal, "context_agent")
					)
				)
				.orderBy(desc(toolAccessPermission.createdAt));
			return records.map(toToolAccessPermission);
		},
		async grantContextAgentPermission(ownerId, projectId, input) {
			const ownedProject = await getOwnedProject(ownerId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [record] = await db
				.insert(toolAccessPermission)
				.values({
					id: crypto.randomUUID(),
					principal: "context_agent",
					projectId,
					purpose: input.purpose,
					scopes: input.scopes,
					grantedByUserId: ownerId,
				})
				.returning();
			if (!record) {
				throw new Error("Context Agent permission could not be created");
			}
			return toToolAccessPermission(record);
		},
		async revokeContextAgentPermission(ownerId, projectId, permissionId) {
			const [record] = await db
				.select({ revokedAt: toolAccessPermission.revokedAt })
				.from(toolAccessPermission)
				.innerJoin(project, eq(project.id, toolAccessPermission.projectId))
				.where(
					and(
						eq(project.ownerId, ownerId),
						eq(project.id, projectId),
						eq(toolAccessPermission.id, permissionId),
						eq(toolAccessPermission.principal, "context_agent")
					)
				)
				.limit(1);
			if (!record) {
				return false;
			}
			if (!record.revokedAt) {
				await db
					.update(toolAccessPermission)
					.set({ revokedAt: new Date() })
					.where(
						and(
							eq(toolAccessPermission.id, permissionId),
							eq(toolAccessPermission.projectId, projectId),
							isNull(toolAccessPermission.revokedAt)
						)
					);
			}
			return true;
		},
		async hasContextAgentPermission(projectId, purpose, scope) {
			const records = await db
				.select({ scopes: toolAccessPermission.scopes })
				.from(toolAccessPermission)
				.where(
					and(
						eq(toolAccessPermission.projectId, projectId),
						eq(toolAccessPermission.principal, "context_agent"),
						eq(toolAccessPermission.purpose, purpose),
						isNull(toolAccessPermission.revokedAt)
					)
				);
			return records.some((record) => record.scopes.includes(scope));
		},
	};
}
