import { isDeepStrictEqual } from "node:util";
import {
	type MarketingUsageReviewStore,
	marketingUsageReviewRecordSchema,
} from "@sprite-anvil/api/marketing-usage-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { marketingUsageReviews } from "@sprite-anvil/db/schema/marketing-usage-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createMarketingUsageReviewStore(
	db: Database
): MarketingUsageReviewStore {
	const store: MarketingUsageReviewStore = {
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
				.from(marketingUsageReviews)
				.where(
					and(
						eq(marketingUsageReviews.projectId, projectId),
						eq(marketingUsageReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(marketingUsageReviews.createdAt),
					desc(marketingUsageReviews.id)
				);
			return rows
				.map((row) => marketingUsageReviewRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersionIds.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = marketingUsageReviewRecordSchema.parse(rawRecord);
			const recordJson = JSON.stringify(record);
			const versionPinsJson = JSON.stringify(record.versionPins);
			await db.execute(sql`
INSERT INTO marketing_usage_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${recordJson}::text::jsonb, ${userId}
FROM asset_families f JOIN project p ON p.id = f.project_id
WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
AND f.visual_world_id = ${record.visualWorldId}
AND (
 (${record.canonicalDesignId}::text IS NULL AND NOT EXISTS (SELECT 1 FROM asset_family_canonical_designs c WHERE c.project_id = p.id AND c.asset_family_id = f.id))
 OR EXISTS (SELECT 1 FROM asset_family_canonical_designs c WHERE c.id = ${record.canonicalDesignId} AND c.asset_version_id = ${record.canonicalAssetVersionId} AND c.project_id = p.id AND c.asset_family_id = f.id AND c.asset_version_id = f.canonical_version_id)
)
AND ${record.reviewedByUserId} = ${userId}
AND EXISTS (
	SELECT 1 FROM project_specialized_profile_contracts a
	JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
	WHERE a.project_id = p.id AND a.profile_id = 'portrait_logo_marketing'
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
        AND v.source_image_width = (pin->'naturalSize'->>'width')::integer
        AND v.source_image_height = (pin->'naturalSize'->>'height')::integer
		AND ar.name = pin->>'assetRecordName'
		AND ar.asset_category = 'portrait_logo_marketing'
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
