import { isDeepStrictEqual } from "node:util";
import {
	type AnimationTimingReviewStore,
	animationTimingReviewRecordSchema,
} from "@sprite-anvil/api/animation-timing-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { animationTimingReviews } from "@sprite-anvil/db/schema/animation-timing-reviews";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createAnimationTimingReviewStore(
	db: Database
): AnimationTimingReviewStore {
	const store: AnimationTimingReviewStore = {
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
			const accessibleVersions = await store.listAccessibleVersionIds(
				userId,
				projectId,
				assetFamilyId
			);
			if (!accessibleVersions) {
				return null;
			}
			const rows = await db
				.select()
				.from(animationTimingReviews)
				.where(
					and(
						eq(animationTimingReviews.projectId, projectId),
						eq(animationTimingReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(animationTimingReviews.createdAt),
					desc(animationTimingReviews.id)
				);
			return rows
				.map((row) => animationTimingReviewRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersions.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = animationTimingReviewRecordSchema.parse(rawRecord);
			// One INSERT SELECT keeps authorization and exact target checks at the write boundary.
			// HTTP Drizzle supports atomic SQL statements, not interactive transactions.
			await db.execute(sql`
 INSERT INTO animation_timing_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
 SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${JSON.stringify(record)}::text::jsonb, ${userId}
 FROM asset_families f JOIN project p ON p.id = f.project_id
 WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.reviewedByUserId} = ${userId}
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
