import { isDeepStrictEqual } from "node:util";
import {
	type IconFamilyReviewStore,
	iconFamilyReviewRecordSchema,
} from "@sprite-anvil/api/icon-family-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { iconFamilyReviews } from "@sprite-anvil/db/schema/icon-family-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createIconFamilyReviewStore(
	db: Database
): IconFamilyReviewStore {
	const store: IconFamilyReviewStore = {
		async listAccessibleVersionIds(userId, projectId, assetFamilyId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [family] = await db
				.select({ id: assetFamilies.id })
				.from(assetFamilies)
				.where(
					and(
						eq(assetFamilies.projectId, projectId),
						eq(assetFamilies.id, assetFamilyId)
					)
				)
				.limit(1);
			if (!family) {
				return null;
			}
			const versions = await db
				.select({ id: assetVersions.id })
				.from(assetVersions)
				.innerJoin(
					assetRecords,
					eq(assetVersions.assetRecordId, assetRecords.id)
				)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.assetFamilyId, assetFamilyId),
						ne(assetRecords.availability, "erased")
					)
				);
			return new Set(versions.map((version) => version.id));
		},
		async list(userId, projectId, assetFamilyId) {
			const accessibleVersionIds = await store.listAccessibleVersionIds(
				userId,
				projectId,
				assetFamilyId
			);
			if (!accessibleVersionIds) {
				return null;
			}
			const rows = await db
				.select()
				.from(iconFamilyReviews)
				.where(
					and(
						eq(iconFamilyReviews.projectId, projectId),
						eq(iconFamilyReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(desc(iconFamilyReviews.createdAt), desc(iconFamilyReviews.id));
			return rows
				.map((row) => iconFamilyReviewRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersionIds.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = iconFamilyReviewRecordSchema.parse(rawRecord);
			const recordJson = JSON.stringify(record);
			const versionPinsJson = JSON.stringify(record.versionPins);
			await db.execute(sql`
INSERT INTO icon_family_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${recordJson}::text::jsonb, ${userId}
FROM asset_families f JOIN project p ON p.id = f.project_id
WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
AND ${record.reviewedByUserId} = ${userId}
AND EXISTS (
	SELECT 1 FROM project_specialized_profile_contracts a
	JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
	WHERE a.project_id = p.id AND a.profile_id = 'icon'
	AND a.contract_revision_id = ${record.contractRevisionId}
	AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb
)
AND NOT EXISTS (
	SELECT 1 FROM jsonb_array_elements(${versionPinsJson}::text::jsonb) pin
	WHERE NOT EXISTS (
		SELECT 1 FROM asset_versions v
		JOIN asset_records ar ON ar.id = v.asset_record_id
		WHERE v.id = pin->>'assetVersionId'
		AND v.asset_record_id = pin->>'assetRecordId'
		AND v.project_id = p.id AND v.asset_family_id = f.id
		AND v.version_number = (pin->>'versionNumber')::integer
		AND v.content_type = pin->>'contentType'
		AND v.byte_size = (pin->>'contentLength')::integer
		AND v.content_digest = pin->>'contentDigest'
		AND v.integrity_verified = true
		AND ar.name = pin->>'assetRecordName'
		AND ar.asset_category = 'icon'
		AND ar.availability <> 'erased'
	)
)
AND NOT EXISTS (
	SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.items)}::text::jsonb) item
	WHERE NOT EXISTS (
		SELECT 1 FROM jsonb_array_elements(${versionPinsJson}::text::jsonb) pin
		WHERE pin->>'assetVersionId' = item->>'assetVersionId'
		AND pin->>'assetRecordId' = item->>'assetRecordId'
	)
)
ON CONFLICT DO NOTHING`);

			const records = await store.list(
				userId,
				record.projectId,
				record.assetFamilyId
			);
			const saved = records?.find(
				(candidate) =>
					candidate.id === record.id && candidate.reviewedByUserId === userId
			);
			return saved &&
				isDeepStrictEqual(
					{ ...saved, createdAt: null },
					{ ...record, createdAt: null }
				)
				? saved
				: null;
		},
	};
	return store;
}
