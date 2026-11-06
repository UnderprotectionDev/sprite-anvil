import type { Database } from "@sprite-anvil/db";
import { assetFamilies } from "@sprite-anvil/db/schema/asset-records";
import {
	deliveryTargetDraftFamilies,
	deliveryTargetDrafts,
	deliveryTargetRevisions,
	deliveryTargets,
} from "@sprite-anvil/db/schema/delivery-planning";
import { familyRequiredSetRevisions } from "@sprite-anvil/db/schema/family-readiness";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
	DeliveryPlanningStorage,
	PinnedFamily,
	PinnedScope,
	StoredDeliveryTarget,
	StoredDeliveryTargetDraft,
	StoredDeliveryTargetRevision,
} from "./delivery-planning-storage";
import { pinnedScopeOf } from "./delivery-planning-storage";

const uniqueViolationCode = "23505";
const foreignKeyViolationCode = "23503";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function isUniqueViolation(error: unknown) {
	return hasErrorCode(error, uniqueViolationCode);
}

function isForeignKeyViolation(error: unknown) {
	return hasErrorCode(error, foreignKeyViolationCode);
}

async function readFamilies(
	db: Database,
	projectId: string,
	draftIds: string[]
) {
	const byDraft = new Map<string, PinnedFamily[]>();
	if (draftIds.length === 0) {
		return byDraft;
	}
	const rows = await db
		.select()
		.from(deliveryTargetDraftFamilies)
		.where(
			and(
				eq(deliveryTargetDraftFamilies.projectId, projectId),
				inArray(deliveryTargetDraftFamilies.draftId, draftIds)
			)
		)
		.orderBy(asc(deliveryTargetDraftFamilies.position));
	for (const row of rows) {
		byDraft.set(row.draftId, [
			...(byDraft.get(row.draftId) ?? []),
			{
				assetFamilyId: row.assetFamilyId,
				requiredSetRevisionId: row.requiredSetRevisionId,
			},
		]);
	}
	return byDraft;
}

/** The pinned columns of a draft row, the only place they are mapped from the database. */
function pinnedScopeFromRow(
	row: typeof deliveryTargetDrafts.$inferSelect,
	families: Map<string, PinnedFamily[]>
): PinnedScope {
	return pinnedScopeOf({
		...row,
		families: families.get(row.id) ?? [],
	});
}

function toDraft(
	row: typeof deliveryTargetDrafts.$inferSelect,
	families: Map<string, PinnedFamily[]>
): StoredDeliveryTargetDraft {
	return {
		...pinnedScopeFromRow(row, families),
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		deliveryTargetId: row.deliveryTargetId,
		id: row.id,
		projectId: row.projectId,
	};
}

async function readRevisions(
	db: Database,
	projectId: string,
	draftFilter?: string
) {
	const rows = await db
		.select({
			draft: deliveryTargetDrafts,
			revision: deliveryTargetRevisions,
		})
		.from(deliveryTargetRevisions)
		.innerJoin(
			deliveryTargetDrafts,
			eq(deliveryTargetDrafts.id, deliveryTargetRevisions.draftId)
		)
		.where(
			and(
				eq(deliveryTargetRevisions.projectId, projectId),
				draftFilter
					? eq(deliveryTargetRevisions.draftId, draftFilter)
					: undefined
			)
		)
		.orderBy(
			asc(deliveryTargetRevisions.deliveryTargetId),
			asc(deliveryTargetRevisions.revisionNumber)
		);
	const families = await readFamilies(
		db,
		projectId,
		rows.map((row) => row.revision.draftId)
	);
	return rows.map(
		({ draft, revision }): StoredDeliveryTargetRevision => ({
			...pinnedScopeFromRow(draft, families),
			activatedAt: revision.activatedAt,
			activatedByUserId: revision.activatedByUserId,
			deliveryTargetId: revision.deliveryTargetId,
			draftId: revision.draftId,
			id: revision.id,
			projectId: revision.projectId,
			revisionNumber: revision.revisionNumber,
		})
	);
}

/** Delivery Target storage over the planning tables; pinned Context Revisions and Required Items List revisions are only read. */
export function createDatabaseDeliveryPlanningStorage(
	db: Database
): DeliveryPlanningStorage {
	const storage: DeliveryPlanningStorage = {
		async findContextRevisions(projectId, ids) {
			if (ids.length === 0) {
				return [];
			}
			return await db
				.select({
					id: contextRevisions.id,
					revisionNumber: contextRevisions.revisionNumber,
				})
				.from(contextRevisions)
				.where(
					and(
						eq(contextRevisions.projectId, projectId),
						inArray(contextRevisions.id, ids)
					)
				);
		},
		async findDraft(projectId, draftId) {
			const [row] = await db
				.select()
				.from(deliveryTargetDrafts)
				.where(
					and(
						eq(deliveryTargetDrafts.projectId, projectId),
						eq(deliveryTargetDrafts.id, draftId)
					)
				)
				.limit(1);
			if (!row) {
				return null;
			}
			return toDraft(row, await readFamilies(db, projectId, [row.id]));
		},
		async findRequiredSetRevisions(projectId, ids) {
			if (ids.length === 0) {
				return [];
			}
			const rows = await db
				.select({
					assetFamilyId: familyRequiredSetRevisions.assetFamilyId,
					assetFamilyName: assetFamilies.name,
					id: familyRequiredSetRevisions.id,
					items: familyRequiredSetRevisions.items,
					revisionNumber: familyRequiredSetRevisions.revisionNumber,
				})
				.from(familyRequiredSetRevisions)
				.innerJoin(
					assetFamilies,
					and(
						eq(assetFamilies.projectId, familyRequiredSetRevisions.projectId),
						eq(assetFamilies.id, familyRequiredSetRevisions.assetFamilyId)
					)
				)
				.where(
					and(
						eq(familyRequiredSetRevisions.projectId, projectId),
						inArray(familyRequiredSetRevisions.id, ids)
					)
				);
			return rows;
		},
		async findRevisionForDraft(projectId, draftId) {
			const [revision] = await readRevisions(db, projectId, draftId);
			return revision ?? null;
		},
		async findTarget(projectId, deliveryTargetId) {
			const [row] = await db
				.select({
					id: deliveryTargets.id,
					name: deliveryTargets.name,
					projectId: deliveryTargets.projectId,
					purpose: deliveryTargets.purpose,
				})
				.from(deliveryTargets)
				.where(
					and(
						eq(deliveryTargets.projectId, projectId),
						eq(deliveryTargets.id, deliveryTargetId)
					)
				)
				.limit(1);
			return row ?? null;
		},
		async insertDraft(target, draft) {
			const { families, ...draftColumns } = draft;
			try {
				await db.batch([
					db
						.insert(deliveryTargets)
						.values({
							createdByUserId: draft.createdByUserId,
							id: target.id,
							name: target.name,
							projectId: target.projectId,
							purpose: target.purpose,
						})
						.onConflictDoNothing(),
					db.insert(deliveryTargetDrafts).values(draftColumns),
					db.insert(deliveryTargetDraftFamilies).values(
						families.map((family, position) => ({
							assetFamilyId: family.assetFamilyId,
							draftId: draft.id,
							position,
							projectId: draft.projectId,
							requiredSetRevisionId: family.requiredSetRevisionId,
						}))
					),
				]);
				return "inserted";
			} catch (error) {
				if (
					isUniqueViolation(error) &&
					(await storage.findDraft(draft.projectId, draft.id))
				) {
					return "draft_exists";
				}
				// The target id exists, but under another project, so the draft's
				// project-scoped target reference has nothing to point at.
				if (
					isForeignKeyViolation(error) &&
					!(await storage.findTarget(draft.projectId, target.id))
				) {
					return "target_in_other_project";
				}
				throw error;
			}
		},
		async insertRevision(revision) {
			try {
				await db.insert(deliveryTargetRevisions).values({
					activatedAt: revision.activatedAt,
					activatedByUserId: revision.activatedByUserId,
					deliveryTargetId: revision.deliveryTargetId,
					draftId: revision.draftId,
					id: revision.id,
					projectId: revision.projectId,
					revisionNumber: sql`(select coalesce(max(${deliveryTargetRevisions.revisionNumber}), 0) + 1 from ${deliveryTargetRevisions} where ${deliveryTargetRevisions.deliveryTargetId} = ${revision.deliveryTargetId})`,
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
					return { status: "conflict" };
				}
				throw error;
			}
			const stored = await readRevisions(
				db,
				revision.projectId,
				revision.draftId
			);
			const [inserted] = stored;
			if (!inserted) {
				throw new Error(
					"The activated Delivery Target revision was not stored."
				);
			}
			return { revision: inserted, status: "inserted" };
		},
		async listDrafts(projectId) {
			const rows = await db
				.select()
				.from(deliveryTargetDrafts)
				.where(eq(deliveryTargetDrafts.projectId, projectId))
				.orderBy(
					asc(deliveryTargetDrafts.createdAt),
					asc(deliveryTargetDrafts.id)
				);
			const families = await readFamilies(
				db,
				projectId,
				rows.map((row) => row.id)
			);
			return rows.map((row) => toDraft(row, families));
		},
		listRevisions: (projectId) => readRevisions(db, projectId),
		async listTargets(projectId): Promise<StoredDeliveryTarget[]> {
			return await db
				.select({
					id: deliveryTargets.id,
					name: deliveryTargets.name,
					projectId: deliveryTargets.projectId,
					purpose: deliveryTargets.purpose,
				})
				.from(deliveryTargets)
				.where(eq(deliveryTargets.projectId, projectId))
				.orderBy(asc(deliveryTargets.createdAt), asc(deliveryTargets.id));
		},
	};
	return storage;
}
