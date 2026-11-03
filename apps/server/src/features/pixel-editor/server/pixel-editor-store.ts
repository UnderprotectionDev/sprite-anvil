import {
	type PixelDraftRecord,
	type PixelDraftUpdateResult,
	type PixelEditorStore,
	type PixelOperation,
	pixelOperationSchema,
} from "@sprite-anvil/api/pixel-editor";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { pixelEditorDrafts } from "@sprite-anvil/db/schema/pixel-editor";
import { and, eq, sql } from "drizzle-orm";
import z from "zod";

const operationsSchema = z.array(pixelOperationSchema);

function toRecord(
	row: typeof pixelEditorDrafts.$inferSelect
): PixelDraftRecord {
	return {
		id: row.id,
		projectId: row.projectId,
		assetFamilyId: row.assetFamilyId,
		assetRecordId: row.assetRecordId,
		sourceAssetVersionId: row.sourceAssetVersionId,
		ownerUserId: row.ownerUserId,
		status: row.status,
		operations: operationsSchema.parse(row.operations),
		appliedOperationCount: row.appliedOperationCount,
		revision: row.revision,
		committedAssetVersionId: row.committedAssetVersionId,
		updatedAt: row.updatedAt,
	};
}

export function createPixelEditorStore(db: Database): PixelEditorStore {
	function ownedDraft(userId: string, projectId: string, draftId: string) {
		return and(
			eq(pixelEditorDrafts.id, draftId),
			eq(pixelEditorDrafts.projectId, projectId),
			eq(pixelEditorDrafts.ownerUserId, userId)
		);
	}

	async function readOwned(userId: string, projectId: string, draftId: string) {
		const [row] = await db
			.select()
			.from(pixelEditorDrafts)
			.where(ownedDraft(userId, projectId, draftId))
			.limit(1);
		return row ?? null;
	}

	async function updateOpen(
		userId: string,
		projectId: string,
		draftId: string,
		expectedRevision: number | null,
		values: Partial<typeof pixelEditorDrafts.$inferInsert>
	): Promise<PixelDraftUpdateResult | null> {
		const [updated] = await db
			.update(pixelEditorDrafts)
			.set({
				...values,
				revision: sql`${pixelEditorDrafts.revision} + 1`,
				updatedAt: new Date(),
			})
			.where(
				and(
					ownedDraft(userId, projectId, draftId),
					eq(pixelEditorDrafts.status, "open"),
					...(expectedRevision === null
						? []
						: [eq(pixelEditorDrafts.revision, expectedRevision)])
				)
			)
			.returning();
		if (updated) {
			return { kind: "updated", draft: toRecord(updated) };
		}
		const current = await readOwned(userId, projectId, draftId);
		if (!current) {
			return null;
		}
		return current.status === "open"
			? { kind: "conflict" }
			: { kind: "not-open" };
	}

	return {
		async createDraft(userId, input) {
			if (!(await getProjectForUser(db, userId, input.projectId))) {
				return null;
			}
			const [created] = await db
				.insert(pixelEditorDrafts)
				.values({
					...input,
					ownerUserId: userId,
					operations: [],
				})
				.onConflictDoNothing()
				.returning();
			if (created) {
				return { kind: "created", draft: toRecord(created) };
			}
			const [existing] = await db
				.select()
				.from(pixelEditorDrafts)
				.where(
					and(
						eq(pixelEditorDrafts.projectId, input.projectId),
						eq(pixelEditorDrafts.ownerUserId, userId),
						eq(
							pixelEditorDrafts.sourceAssetVersionId,
							input.sourceAssetVersionId
						),
						eq(pixelEditorDrafts.status, "open")
					)
				)
				.limit(1);
			return existing ? { kind: "existing", draft: toRecord(existing) } : null;
		},

		async getDraft(userId, projectId, draftId) {
			const row = await readOwned(userId, projectId, draftId);
			return row ? toRecord(row) : null;
		},

		updateOperations(userId, projectId, draftId, update) {
			return updateOpen(userId, projectId, draftId, update.expectedRevision, {
				operations: update.operations satisfies PixelOperation[],
				appliedOperationCount: update.appliedOperationCount,
			});
		},

		markCommitted(userId, projectId, draftId, assetVersionId) {
			return updateOpen(userId, projectId, draftId, null, {
				status: "committed",
				committedAssetVersionId: assetVersionId,
			});
		},

		discardDraft(userId, projectId, draftId) {
			return updateOpen(userId, projectId, draftId, null, {
				status: "discarded",
			});
		},
	};
}
