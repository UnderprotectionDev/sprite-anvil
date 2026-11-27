import { ORPCError } from "@orpc/server";
import { isExternalVisualAnalysisProviderPolicyVerified } from "@sprite-anvil/api/external-visual-analysis-policy";
import type {
	ContextAgentScope,
	ExternalVisualAnalysisPermission,
	ProjectAccessStore,
	ProjectRecord,
	ToolAccessPermission,
} from "@sprite-anvil/api/project-access-store";
import {
	contextAgentScopes,
	externalVisualAnalysisPurposeByCategory,
} from "@sprite-anvil/api/project-access-store";
import type { ProjectContextStore } from "@sprite-anvil/api/project-context";
import type { Database } from "@sprite-anvil/db";
import { getProjectForUser, publishedProjectPredicate } from "@sprite-anvil/db";
import type { InteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import {
	assertAvailableProjectNameInTransaction,
	ProjectNameConflictError,
} from "@sprite-anvil/db/project-name";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { externalVisualAnalysisPermission } from "@sprite-anvil/db/schema/external-visual-analysis";
import { project } from "@sprite-anvil/db/schema/project";
import { toolAccessPermission } from "@sprite-anvil/db/schema/project-access";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

function toProjectRecord(
	record: Pick<typeof project.$inferSelect, "createdAt" | "id" | "name">
): ProjectRecord {
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

function toExternalVisualAnalysisPermission(
	record: typeof externalVisualAnalysisPermission.$inferSelect
): ExternalVisualAnalysisPermission {
	if (
		record.purpose !== externalVisualAnalysisPurposeByCategory[record.category]
	) {
		throw new Error("Unsupported External Visual Analysis permission purpose");
	}

	return {
		category: record.category,
		createdAt: record.createdAt.toISOString(),
		id: record.id,
		projectId: record.projectId,
		purpose: record.purpose,
		revokedAt: record.revokedAt?.toISOString() ?? null,
	};
}

export function createProjectAccessStore(
	db: Database,
	projectContextStore: ProjectContextStore,
	interactiveDb?: InteractiveDatabase
): ProjectAccessStore {
	return {
		async createProject(ownerId, input, previewKey, requestId) {
			const record = await projectContextStore.createProject(
				ownerId,
				input,
				previewKey,
				requestId
			);
			return {
				createdAt: record.createdAt,
				id: record.id,
				name: record.name,
				generalArtDirection: record.generalArtDirection,
				hasPreview: Boolean(previewKey),
			};
		},
		async getProject(ownerId, projectId) {
			const record = await getProjectForUser(db, ownerId, projectId);
			return record
				? {
						...toProjectRecord(record),
						generalArtDirection: record.generalArtDirection,
					}
				: null;
		},
		async updateProject(ownerId, projectId, input) {
			if (!interactiveDb) {
				throw new Error("Project update storage unavailable.");
			}
			const record = await interactiveDb
				.transaction(async (tx) => {
					await assertAvailableProjectNameInTransaction(
						tx,
						ownerId,
						input.name,
						projectId
					);
					const [updated] = await tx
						.update(project)
						.set({
							name: input.name,
							generalArtDirection: input.generalArtDirection,
						})
						.where(
							and(
								eq(project.id, projectId),
								eq(project.ownerUserId, ownerId),
								publishedProjectPredicate()
							)
						)
						.returning();
					return updated;
				})
				.catch((error) => {
					if (error instanceof ProjectNameConflictError) {
						throw new ORPCError("CONFLICT", { message: error.message });
					}
					throw error;
				});
			return record
				? {
						...toProjectRecord(record),
						generalArtDirection: record.generalArtDirection,
					}
				: null;
		},
		async listProjects(ownerId) {
			const records = await db
				.select({
					id: project.id,
					name: project.name,
					createdAt: project.createdAt,
					generalArtDirection: project.generalArtDirection,
					previewKey: project.previewKey,
					previewAssetVersionId: sql<string | null>`(
						select av.id
						from ${assetVersions} av
						join ${assetRecords} ar on ar.id = av.asset_record_id
							and ar.project_id = av.project_id
						where av.project_id = "project"."id"
							and ar.availability = 'active'
							and ar.asset_category = 'background_parallax'
							and av.integrity_verified = true
						order by av.created_at desc, av.id
						limit 1
					)`,
				})
				.from(project)
				.where(
					and(eq(project.ownerUserId, ownerId), publishedProjectPredicate())
				)
				.orderBy(desc(project.createdAt));
			return records.map((record) => ({
				...toProjectRecord(record),
				generalArtDirection: record.generalArtDirection,
				previewAssetVersionId: record.previewAssetVersionId,
				hasPreview: Boolean(record.previewKey),
			}));
		},
		async listContextAgentPermissions(ownerId, projectId) {
			const ownedProject = await getProjectForUser(db, ownerId, projectId);
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
		async listExternalVisualAnalysisPermissions(ownerId, projectId) {
			const ownedProject = await getProjectForUser(db, ownerId, projectId);
			if (!ownedProject) {
				return null;
			}
			const records = await db
				.select()
				.from(externalVisualAnalysisPermission)
				.where(and(eq(externalVisualAnalysisPermission.projectId, projectId)))
				.orderBy(desc(externalVisualAnalysisPermission.createdAt));
			return records.map(toExternalVisualAnalysisPermission);
		},
		async grantContextAgentPermission(ownerId, projectId, input) {
			const ownedProject = await getProjectForUser(db, ownerId, projectId);
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
		async grantExternalVisualAnalysisPermission(ownerId, projectId, input) {
			if (!isExternalVisualAnalysisProviderPolicyVerified()) {
				return null;
			}

			const ownedProject = await getProjectForUser(db, ownerId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [record] = await db
				.insert(externalVisualAnalysisPermission)
				.values({
					id: crypto.randomUUID(),
					projectId,
					category: input.category,
					purpose: externalVisualAnalysisPurposeByCategory[input.category],
					grantedByUserId: ownerId,
				})
				.returning();
			if (!record) {
				throw new Error(
					"External Visual Analysis permission could not be created"
				);
			}
			return toExternalVisualAnalysisPermission(record);
		},
		async revokeContextAgentPermission(ownerId, projectId, permissionId) {
			const [record] = await db
				.select({ revokedAt: toolAccessPermission.revokedAt })
				.from(toolAccessPermission)
				.innerJoin(project, eq(project.id, toolAccessPermission.projectId))
				.where(
					and(
						and(eq(project.ownerUserId, ownerId), publishedProjectPredicate()),
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
		async revokeExternalVisualAnalysisPermission(
			ownerId,
			projectId,
			permissionId
		) {
			const [record] = await db
				.select({ category: externalVisualAnalysisPermission.category })
				.from(externalVisualAnalysisPermission)
				.innerJoin(
					project,
					eq(project.id, externalVisualAnalysisPermission.projectId)
				)
				.where(
					and(
						and(eq(project.ownerUserId, ownerId), publishedProjectPredicate()),
						eq(project.id, projectId),
						eq(externalVisualAnalysisPermission.id, permissionId)
					)
				)
				.limit(1);
			if (!record) {
				return false;
			}
			await db
				.update(externalVisualAnalysisPermission)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(externalVisualAnalysisPermission.projectId, projectId),
						eq(externalVisualAnalysisPermission.category, record.category),
						isNull(externalVisualAnalysisPermission.revokedAt)
					)
				);
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
		async hasExternalVisualAnalysisPermission(projectId, category) {
			if (!isExternalVisualAnalysisProviderPolicyVerified()) {
				return false;
			}

			const records = await db
				.select({
					category: externalVisualAnalysisPermission.category,
					purpose: externalVisualAnalysisPermission.purpose,
				})
				.from(externalVisualAnalysisPermission)
				.where(
					and(
						eq(externalVisualAnalysisPermission.projectId, projectId),
						eq(externalVisualAnalysisPermission.category, category),
						isNull(externalVisualAnalysisPermission.revokedAt)
					)
				);
			return records.some(
				(record) =>
					record.category === category &&
					record.purpose === externalVisualAnalysisPurposeByCategory[category]
			);
		},
	};
}

export async function setProjectPreviewKey(
	db: Database,
	ownerId: string,
	projectId: string,
	previewKey: string
) {
	const rows = await db
		.update(project)
		.set({ previewKey })
		.where(
			and(
				eq(project.id, projectId),
				eq(project.ownerUserId, ownerId),
				publishedProjectPredicate()
			)
		)
		.returning({ id: project.id });
	return rows.length > 0;
}
