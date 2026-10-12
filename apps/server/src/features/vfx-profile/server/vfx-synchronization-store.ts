import { isDeepStrictEqual } from "node:util";
import {
	type VfxSynchronizationStore,
	vfxSynchronizationRecordSchema,
} from "@sprite-anvil/api/vfx-synchronization";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { vfxSynchronizationReviews } from "@sprite-anvil/db/schema/vfx-synchronization";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createVfxSynchronizationStore(
	db: Database
): VfxSynchronizationStore {
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

					ne(assetRecords.availability, "erased")
				)
			);
		return new Set(versions.map((version) => version.id));
	}
	const store: VfxSynchronizationStore = {
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
				.select()
				.from(vfxSynchronizationReviews)
				.where(
					and(
						eq(vfxSynchronizationReviews.projectId, projectId),
						eq(vfxSynchronizationReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(vfxSynchronizationReviews.createdAt),
					desc(vfxSynchronizationReviews.id)
				);
			return rows
				.map((row) => vfxSynchronizationRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersions.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = vfxSynchronizationRecordSchema.parse(rawRecord);
			// One INSERT SELECT keeps authorization and exact target checks at the write boundary.
			// HTTP Drizzle supports atomic SQL statements, not interactive transactions.
			await db.execute(sql`
 INSERT INTO vfx_synchronization_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
 SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${JSON.stringify(record)}::text::jsonb, ${userId}
 FROM asset_families f JOIN project p ON p.id = f.project_id
 WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.reviewedByUserId} = ${userId}
 AND EXISTS (SELECT 1 FROM project_specialized_profile_contracts a JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id WHERE a.project_id = p.id AND a.profile_id = 'visual_effect_projectile_shadow_mark' AND a.contract_revision_id = ${record.contractRevisionId} AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb)
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.versionPins)}::text::jsonb) pin WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id WHERE v.id = pin->>'assetVersionId' AND v.project_id = p.id AND v.asset_family_id = pin->>'assetFamilyId' AND v.asset_record_id = pin->>'assetRecordId' AND v.content_digest = pin->>'contentDigest' AND v.integrity_verified = true AND ar.availability <> 'erased'))
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify([...record.effect.frames, ...record.owner.frames])}::text::jsonb) frame WHERE NOT EXISTS (SELECT 1 FROM unit_versions u WHERE u.id = frame->>'unitVersionId' AND u.project_id = p.id AND u.asset_version_id = frame->>'assetVersionId' AND u.unit_key = frame->>'frameKey' AND u.unit_type = 'frame'))
 AND (${record.sourceReviewId}::text IS NULL OR EXISTS (SELECT 1 FROM vfx_synchronization_reviews source WHERE source.id = ${record.sourceReviewId} AND source.project_id = p.id AND source.asset_family_id = f.id AND source.record->'event' = ${JSON.stringify(record.event)}::text::jsonb))

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
