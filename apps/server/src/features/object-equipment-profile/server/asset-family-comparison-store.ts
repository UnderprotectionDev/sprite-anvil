import { isDeepStrictEqual } from "node:util";
import {
	type AssetFamilyComparisonStore,
	assetFamilyComparisonRecordSchema,
} from "@sprite-anvil/api/asset-family-comparisons";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetFamilyComparisons } from "@sprite-anvil/db/schema/asset-family-comparisons";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createAssetFamilyComparisonStore(
	db: Database
): AssetFamilyComparisonStore {
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

	const store: AssetFamilyComparisonStore = {
		async list(userId, projectId, assetFamilyId) {
			const accessibleVersions = await listAccessibleVersionIds(
				userId,
				projectId,
				assetFamilyId
			);
			if (!accessibleVersions) {
				return null;
			}
			const rows = await db
				.select({ record: assetFamilyComparisons.record })
				.from(assetFamilyComparisons)
				.where(
					and(
						eq(assetFamilyComparisons.projectId, projectId),
						eq(assetFamilyComparisons.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(assetFamilyComparisons.createdAt),
					desc(assetFamilyComparisons.id)
				);
			return rows
				.map((row) => assetFamilyComparisonRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersions.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = assetFamilyComparisonRecordSchema.parse(rawRecord);
			await db.execute(sql`
 INSERT INTO asset_family_comparisons (id, project_id, asset_family_id, created_by_user_id, record, created_at)
 SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${userId}, ${JSON.stringify(record)}::text::jsonb, ${new Date(record.createdAt)}
 FROM asset_families f JOIN project p ON p.id = f.project_id
 WHERE f.id = ${record.assetFamilyId} AND f.project_id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.reviewedByUserId} = ${userId}
 AND EXISTS (
   SELECT 1
   FROM project_specialized_profile_contracts a
   JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
   WHERE a.project_id = p.id
     AND a.profile_id = 'object_weapon_equipment_states'
     AND a.contract_revision_id = ${record.contractRevisionId}
     AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb
 )
 AND NOT EXISTS (
   SELECT 1
   FROM jsonb_array_elements(${JSON.stringify(record.assetVersions)}::text::jsonb) selected
   WHERE NOT EXISTS (
     SELECT 1
     FROM asset_versions v
     JOIN asset_records ar ON ar.id = v.asset_record_id
     WHERE v.id = selected->>'assetVersionId'
       AND v.asset_record_id = selected->>'assetRecordId'
       AND v.project_id = p.id
       AND v.asset_family_id = f.id
       AND v.version_number = (
         SELECT MAX(latest.version_number)
         FROM asset_versions latest
         WHERE latest.project_id = p.id
           AND latest.asset_record_id = v.asset_record_id
       )
       AND v.content_digest = (
         SELECT pin->>'contentDigest'
         FROM jsonb_array_elements(${JSON.stringify(record.versionPins)}::text::jsonb) pin
         WHERE pin->>'assetVersionId' = v.id
       )
       AND v.integrity_verified = true
       AND ar.asset_category = 'object_weapon_equipment_states'
       AND ar.availability <> 'erased'
   )
 )
 AND NOT EXISTS (
   SELECT 1
   FROM jsonb_array_elements(${JSON.stringify(record.assetVersions)}::text::jsonb) selected
   CROSS JOIN LATERAL jsonb_array_elements_text(selected->'unitVersionIds') selected_unit(unit_version_id)
 WHERE NOT EXISTS (
   SELECT 1
   FROM unit_versions u
     WHERE u.id = selected_unit.unit_version_id
       AND u.project_id = p.id
       AND u.asset_record_id = selected->>'assetRecordId'
       AND u.asset_version_id = selected->>'assetVersionId'
   )
 )
 AND NOT EXISTS (
   SELECT 1
   FROM jsonb_array_elements(${JSON.stringify(record.assetVersions)}::text::jsonb) selected
   JOIN unit_versions u
     ON u.project_id = ${record.projectId}
    AND u.asset_record_id = selected->>'assetRecordId'
    AND u.asset_version_id = selected->>'assetVersionId'
   WHERE NOT EXISTS (
     SELECT 1
     FROM jsonb_array_elements_text(selected->'unitVersionIds') selected_unit(unit_version_id)
     WHERE selected_unit.unit_version_id = u.id
   )
 )
 ON CONFLICT DO NOTHING`);

			const records = await store.list(
				userId,
				record.projectId,
				record.assetFamilyId
			);
			const saved = records?.find((candidate) => candidate.id === record.id);
			return saved && isDeepStrictEqual(saved, record) ? saved : null;
		},
	};
	return store;
}
