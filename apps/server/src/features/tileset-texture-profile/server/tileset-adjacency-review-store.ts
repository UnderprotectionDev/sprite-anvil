import { isDeepStrictEqual } from "node:util";
import {
	type TilesetAdjacencyReviewStore,
	tilesetAdjacencyReviewRecordSchema,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { tilesetAdjacencyReviews } from "@sprite-anvil/db/schema/tileset-adjacency-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createTilesetAdjacencyReviewStore(
	db: Database
): TilesetAdjacencyReviewStore {
	const store: TilesetAdjacencyReviewStore = {
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
				.from(tilesetAdjacencyReviews)
				.where(
					and(
						eq(tilesetAdjacencyReviews.projectId, projectId),
						eq(tilesetAdjacencyReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(tilesetAdjacencyReviews.createdAt),
					desc(tilesetAdjacencyReviews.id)
				);
			return rows
				.map((row) => tilesetAdjacencyReviewRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersionIds.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = tilesetAdjacencyReviewRecordSchema.parse(rawRecord);
			const recordJson = JSON.stringify(record);
			const versionPinsJson = JSON.stringify(record.versionPins);
			await db.execute(sql`
INSERT INTO tileset_adjacency_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
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
AND (SELECT count(*) FROM composition_memberships m WHERE m.composite_version_id = ${record.compositeVersionId}) = ${record.tiles.length}
AND NOT EXISTS (
 SELECT 1 FROM jsonb_array_elements(${versionPinsJson}::text::jsonb) pin
	WHERE NOT EXISTS (
		SELECT 1 FROM asset_versions v
		JOIN asset_records ar ON ar.id = v.asset_record_id
		WHERE v.id = pin->>'assetVersionId'
		AND v.asset_record_id = (SELECT c.asset_record_id FROM composite_versions c WHERE c.id = ${record.compositeVersionId} AND c.project_id = p.id)
		AND v.project_id = p.id AND v.asset_family_id = f.id
				AND v.content_digest = pin->>'contentDigest'
		AND v.integrity_verified = true
		AND v.source_image_width = (pin->'sourceImageDimensions'->>'width')::integer AND v.source_image_height = (pin->'sourceImageDimensions'->>'height')::integer
 AND EXISTS (SELECT 1 FROM unit_versions u JOIN composition_memberships m ON m.unit_version_id = u.id JOIN composite_versions c ON c.id = m.composite_version_id WHERE u.id = pin->>'unitVersionId' AND u.asset_version_id = v.id AND u.unit_type = 'tile' AND u.unit_key = pin->>'tileId' AND c.id = ${record.compositeVersionId} AND c.project_id = p.id AND c.asset_record_id = ar.id)
		AND ar.asset_category = 'tileset_terrain_texture'
		AND ar.availability <> 'erased'
	)
)
AND NOT EXISTS (
	SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.tiles)}::text::jsonb) item
	WHERE NOT EXISTS (
		SELECT 1 FROM jsonb_array_elements(${versionPinsJson}::text::jsonb) pin
 WHERE pin->>'unitVersionId' = item->>'unitVersionId'
 AND (item->'region'->>'x')::integer + (item->'region'->>'width')::integer <= (pin->'sourceImageDimensions'->>'width')::integer
 AND (item->'region'->>'y')::integer + (item->'region'->>'height')::integer <= (pin->'sourceImageDimensions'->>'height')::integer
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
