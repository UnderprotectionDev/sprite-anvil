import { isDeepStrictEqual } from "node:util";
import {
	type DirectionalReviewStore,
	directionalReviewRecordSchema,
} from "@sprite-anvil/api/directional-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { directionalReviews } from "@sprite-anvil/db/schema/directional-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createDirectionalReviewStore(
	db: Database
): DirectionalReviewStore {
	const store: DirectionalReviewStore = {
		async list(userId, projectId, assetFamilyId) {
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
			const accessibleVersions = new Set(versions.map((version) => version.id));
			const rows = await db
				.select()
				.from(directionalReviews)
				.where(
					and(
						eq(directionalReviews.projectId, projectId),
						eq(directionalReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(directionalReviews.createdAt),
					desc(directionalReviews.id)
				);
			return rows
				.map((row) => directionalReviewRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersions.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = directionalReviewRecordSchema.parse(rawRecord);
			// One INSERT SELECT keeps authorization and exact target checks at the write boundary.
			// HTTP Drizzle supports atomic SQL statements, not interactive transactions.
			await db.execute(sql`
 INSERT INTO directional_reviews (id, project_id, asset_family_id, canonical_design_id, contract_revision_id, record, created_by_user_id)
 SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.canonicalDesignId}, ${record.contractRevisionId}, ${JSON.stringify(record)}::text::jsonb, ${userId}
 FROM asset_families f JOIN project p ON p.id = f.project_id
 WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.reviewedByUserId} = ${userId}
 AND EXISTS (SELECT 1 FROM asset_family_canonical_designs c WHERE c.id = ${record.canonicalDesignId} AND c.project_id = p.id AND c.asset_family_id = f.id AND c.asset_version_id = ${record.canonicalAssetVersionId}
 AND c.id = (SELECT latest.id FROM asset_family_canonical_designs latest WHERE latest.asset_family_id = f.id ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1))
 AND EXISTS (SELECT 1 FROM project_specialized_profile_contracts a JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id WHERE a.project_id = p.id AND a.profile_id = 'character_creature_animation' AND a.contract_revision_id = ${record.contractRevisionId} AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb)
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.versionPins)}::text::jsonb) pin WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id WHERE v.id = pin->>'assetVersionId' AND v.project_id = p.id AND v.asset_family_id = f.id AND v.content_digest = pin->>'contentDigest' AND v.integrity_verified = true AND ar.availability <> 'erased'))
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
