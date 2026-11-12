import { rightsRecordStateSchema } from "@sprite-anvil/api/rights-records";
import type { Database } from "@sprite-anvil/db";
import { historicalRiskNotices } from "@sprite-anvil/db/schema/historical-risk-notices";
import { and, desc, eq } from "drizzle-orm";
import type {
	HistoricalRiskNoticeStorage,
	StoredHistoricalRiskNotice,
} from "./historical-risk-notice-storage";

function toStored(
	row: typeof historicalRiskNotices.$inferSelect
): StoredHistoricalRiskNotice {
	return {
		affectedUsage: row.affectedUsage,
		assetRecordId: row.assetRecordId,
		deliveryTargetId: row.deliveryTargetId,
		detectedAt: row.detectedAt,
		fulfilmentId: row.fulfilmentId,
		id: row.id,
		pinnedPolicy:
			row.pinnedPolicy as StoredHistoricalRiskNotice["pinnedPolicy"],
		pinnedRights: row.pinnedRights,
		projectId: row.projectId,
		revisionId: row.revisionId,
		revisionNumber: row.revisionNumber,
		rightsRecordId: row.rightsRecordId,
		rightsRecordState: rightsRecordStateSchema.parse(row.rightsRecordState),
		rightsRecordVersionNumber: row.rightsRecordVersionNumber,
	};
}

/** Insert-only: this storage has no update or delete, so a written notice never changes. */
export function createDatabaseHistoricalRiskNoticeStorage(
	db: Database
): HistoricalRiskNoticeStorage {
	return {
		async findNotice(projectId, fulfilmentId, rightsRecordId) {
			const [row] = await db
				.select()
				.from(historicalRiskNotices)
				.where(
					and(
						eq(historicalRiskNotices.projectId, projectId),
						eq(historicalRiskNotices.fulfilmentId, fulfilmentId),
						eq(historicalRiskNotices.rightsRecordId, rightsRecordId)
					)
				)
				.limit(1);
			return row ? toStored(row) : null;
		},
		async insertNotice(notice) {
			const inserted = await db
				.insert(historicalRiskNotices)
				.values(notice)
				.onConflictDoNothing()
				.returning({ id: historicalRiskNotices.id });
			return { status: inserted.length > 0 ? "inserted" : "conflict" };
		},
		async listNotices(projectId, deliveryTargetId) {
			const rows = await db
				.select()
				.from(historicalRiskNotices)
				.where(
					and(
						eq(historicalRiskNotices.projectId, projectId),
						eq(historicalRiskNotices.deliveryTargetId, deliveryTargetId)
					)
				)
				.orderBy(
					desc(historicalRiskNotices.detectedAt),
					desc(historicalRiskNotices.id)
				);
			return rows.map(toStored);
		},
	};
}
