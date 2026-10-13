import { isDeepStrictEqual } from "node:util";
import {
	type SceneQaStore,
	sceneQaRecordSchema,
	sceneQaRoleProfiles,
} from "@sprite-anvil/api/scene-qa";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { sceneQaPlaygrounds } from "@sprite-anvil/db/schema/scene-qa";
import { and, desc, eq, ne, sql } from "drizzle-orm";
export function createSceneQaStore(db: Database): SceneQaStore {
	const store: SceneQaStore = {
		async list(userId, projectId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [rows, versions] = await Promise.all([
				db
					.select()
					.from(sceneQaPlaygrounds)
					.where(eq(sceneQaPlaygrounds.projectId, projectId))
					.orderBy(
						desc(sceneQaPlaygrounds.createdAt),
						desc(sceneQaPlaygrounds.id)
					),
				db
					.select({ id: assetVersions.id })
					.from(assetVersions)
					.innerJoin(
						assetRecords,
						eq(assetRecords.id, assetVersions.assetRecordId)
					)
					.where(
						and(
							eq(assetVersions.projectId, projectId),
							ne(assetRecords.availability, "erased")
						)
					),
			]);
			const accessible = new Set(versions.map((v) => v.id));
			return rows
				.map((row) => sceneQaRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) => accessible.has(pin.assetVersionId))
				);
		},
		async append(userId, rawRecord) {
			const record = sceneQaRecordSchema.parse(rawRecord);
			await db.execute(sql`
 INSERT INTO scene_qa_playgrounds (id, project_id, record, created_by_user_id)
 SELECT ${record.id}, p.id, ${JSON.stringify(record)}::text::jsonb, ${userId}
 FROM project p WHERE p.id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.createdByUserId} = ${userId}
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.versionPins)}::text::jsonb) pin
 WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id
 WHERE v.project_id = p.id AND ar.project_id = p.id AND v.id = pin->>'assetVersionId'
 AND ar.availability <> 'erased' AND v.integrity_verified = true
 AND v.asset_record_id = pin->>'assetRecordId' AND v.asset_family_id = pin->>'assetFamilyId'
 AND ar.name = pin->>'assetRecordName' AND v.content_digest = pin->>'contentDigest'
 AND v.version_number = (pin->>'versionNumber')::integer
 AND v.source_image_width = (pin->>'width')::integer AND v.source_image_height = (pin->>'height')::integer))
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.setup.placements.map((p) => ({ assetVersionId: p.assetVersionId, profileId: sceneQaRoleProfiles[p.role] })))}::text::jsonb) placement
 WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id
 WHERE v.project_id = p.id AND ar.project_id = p.id AND v.id = placement->>'assetVersionId'
 AND ar.asset_category = placement->>'profileId' AND ar.availability <> 'erased'))
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.profilePins)}::text::jsonb) pin
 WHERE NOT EXISTS (SELECT 1 FROM project_specialized_profile_contracts a JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
 WHERE a.project_id = p.id AND a.profile_id = pin->>'profileId' AND a.contract_revision_id = pin->>'contractRevisionId'
 AND r.definition = pin->'contractSnapshot'))
 ON CONFLICT DO NOTHING`);
			const saved = (await store.list(userId, record.projectId))?.find(
				(r) => r.id === record.id
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
