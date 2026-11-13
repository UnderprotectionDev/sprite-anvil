import type { ErasureImpactScope } from "@sprite-anvil/api/permanent-erasure";
import type { Database } from "@sprite-anvil/db";
import { hasErrorCode } from "@sprite-anvil/db/error-codes";
import { erasureImpactReports } from "@sprite-anvil/db/schema/permanent-erasure";
import { and, eq } from "drizzle-orm";
import type { ErasureImpactStorage } from "./erasure-impact-storage";

const uniqueViolationCode = "23505";

export function createDatabaseErasureImpactStorage(
	db: Database
): ErasureImpactStorage {
	return {
		async find(projectId, reportId) {
			const [row] = await db
				.select()
				.from(erasureImpactReports)
				.where(
					and(
						eq(erasureImpactReports.projectId, projectId),
						eq(erasureImpactReports.id, reportId)
					)
				);
			if (!row) {
				return null;
			}
			return {
				assetRecordId: row.targetAssetRecordId,
				contractVersion: row.contractVersion,
				createdAt: row.createdAt,
				createdByUserId: row.createdByUserId,
				id: row.id,
				projectId: row.projectId,
				reportDigest: row.reportDigest,
				requestDigest: row.requestDigest,
				// Revalidated against the contract on every read.
				scope: row.scope as ErasureImpactScope,
			};
		},
		async insert(row) {
			try {
				await db.insert(erasureImpactReports).values({
					contractVersion: row.contractVersion,
					createdAt: row.createdAt,
					createdByUserId: row.createdByUserId,
					id: row.id,
					projectId: row.projectId,
					reportDigest: row.reportDigest,
					requestDigest: row.requestDigest,
					scope: row.scope,
					targetAssetRecordId: row.assetRecordId,
				});
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
	};
}
