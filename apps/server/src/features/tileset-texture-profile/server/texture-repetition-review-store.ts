import { isDeepStrictEqual } from "node:util";
import {
	type TextureRepetitionReviewStore,
	textureRepetitionReviewRecordSchema,
} from "@sprite-anvil/api/texture-repetition-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { textureRepetitionReviews } from "@sprite-anvil/db/schema/texture-repetition-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createTextureRepetitionReviewStore(
	db: Database
): TextureRepetitionReviewStore {
	async function listAccessibleVersionIds(
		userId: string,
		projectId: string,
		assetFamilyId: string
	) {
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
			.innerJoin(assetRecords, eq(assetVersions.assetRecordId, assetRecords.id))
			.where(
				and(
					eq(assetVersions.projectId, projectId),
					eq(assetVersions.assetFamilyId, assetFamilyId),
					ne(assetRecords.availability, "erased")
				)
			);
		return new Set(versions.map((version) => version.id));
	}
	const store: TextureRepetitionReviewStore = {
		async list(userId, projectId, assetFamilyId) {
			const accessibleVersionIds = await listAccessibleVersionIds(
				userId,
				projectId,
				assetFamilyId
			);
			if (!accessibleVersionIds) {
				return null;
			}
			const rows = await db
				.select()
				.from(textureRepetitionReviews)
				.where(
					and(
						eq(textureRepetitionReviews.projectId, projectId),
						eq(textureRepetitionReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(textureRepetitionReviews.createdAt),
					desc(textureRepetitionReviews.id)
				);
			return rows
				.map((row) => textureRepetitionReviewRecordSchema.parse(row.record))
				.filter((record) =>
					accessibleVersionIds.has(record.unitSnapshot.assetVersionId)
				);
		},
		async append(userId, rawRecord) {
			const record = textureRepetitionReviewRecordSchema.parse(rawRecord);
			const recordJson = JSON.stringify(record);

			await db.execute(sql`
INSERT INTO texture_repetition_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${recordJson}::text::jsonb, ${userId}
FROM asset_families f JOIN project p ON p.id = f.project_id
WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
AND ${record.reviewedByUserId} = ${userId}
AND EXISTS (
	SELECT 1 FROM project_specialized_profile_contracts a
	JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
	WHERE a.project_id = p.id AND a.profile_id = 'tileset_terrain_texture'
	AND a.contract_revision_id = ${record.contractRevisionId}
	AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb
)
AND EXISTS (
 SELECT 1 FROM unit_versions u JOIN asset_versions v ON v.id = u.asset_version_id
 JOIN asset_records ar ON ar.id = v.asset_record_id
 WHERE u.id = ${record.unitVersionId} AND u.project_id = p.id
 AND u.unit_type = 'tile' AND u.asset_record_id = ar.id
 AND u.asset_version_id = ${record.unitSnapshot.assetVersionId}
 AND u.unit_key = ${record.unitSnapshot.unitKey}
 AND u.version_number = ${record.unitSnapshot.versionNumber}
 AND v.project_id = p.id AND v.asset_family_id = f.id
 AND v.content_digest = ${record.contentDigest} AND v.integrity_verified = true
 AND ar.asset_category = 'tileset_terrain_texture' AND ar.availability <> 'erased'
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
