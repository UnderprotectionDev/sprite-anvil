import { isDeepStrictEqual } from "node:util";
import {
	type VfxAppearanceReviewStore,
	vfxAppearanceRecordSchema,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { vfxAppearanceReviews } from "@sprite-anvil/db/schema/vfx-appearance-reviews";
import { and, desc, eq, ne, sql } from "drizzle-orm";

export function createVfxAppearanceReviewStore(
	db: Database
): VfxAppearanceReviewStore {
	const store: VfxAppearanceReviewStore = {
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
				.from(vfxAppearanceReviews)
				.where(
					and(
						eq(vfxAppearanceReviews.projectId, projectId),
						eq(vfxAppearanceReviews.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(vfxAppearanceReviews.createdAt),
					desc(vfxAppearanceReviews.id)
				);
			return rows
				.map((row) => vfxAppearanceRecordSchema.parse(row.record))
				.filter((record) =>
					record.versionPins.every((pin) =>
						accessibleVersions.has(pin.assetVersionId)
					)
				);
		},
		async append(userId, rawRecord) {
			const record = vfxAppearanceRecordSchema.parse(rawRecord);
			const waiver = record.qualityWaiverSnapshot;
			const waiverGuard = waiver
				? sql`
 AND EXISTS (
  SELECT 1 FROM family_readiness_evidence e
  JOIN family_required_set_heads h ON h.project_id = e.project_id AND h.asset_family_id = e.asset_family_id AND h.active_revision_id = e.revision_id
  WHERE e.id = ${waiver.id} AND e.project_id = p.id AND e.asset_family_id = f.id
  AND e.kind = 'quality' AND e.result = 'waived' AND e.rule_id = 'effect.cell_overflow'
  AND e.observed_value = ${`${record.measuredOverflowPx} px`}
  AND e.profile_contract_revision_ids @> ${JSON.stringify([record.contractRevisionId])}::text::jsonb
  AND e.visual_world_id = f.visual_world_id AND e.use_context = f.use_context
  AND e.context_revision_id IS NOT DISTINCT FROM (SELECT id FROM context_revisions WHERE project_id = p.id AND (state = 'active' OR revision_number = 0) ORDER BY revision_number DESC LIMIT 1)
  AND e.canonical_design_version_id IS NOT DISTINCT FROM (SELECT asset_version_id FROM asset_family_canonical_designs WHERE project_id = p.id AND asset_family_id = f.id ORDER BY created_at DESC, id DESC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM family_readiness_evidence newer WHERE newer.project_id = e.project_id AND newer.asset_family_id = e.asset_family_id AND newer.revision_id = e.revision_id AND newer.item_id = e.item_id AND newer.kind = e.kind AND newer.rule_id = e.rule_id AND (newer.created_at, newer.id) > (e.created_at, e.id))
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(e.asset_version_ids) expected WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id WHERE v.id = expected.value AND v.project_id = p.id AND ar.availability <> 'erased' AND NOT EXISTS (SELECT 1 FROM asset_versions newer WHERE newer.project_id = p.id AND newer.asset_record_id = v.asset_record_id AND newer.version_number > v.version_number)))
  AND e.unit_version_id IS NOT DISTINCT FROM ${waiver.versionTarget?.kind === "unit" ? waiver.versionTarget.id : null}
  AND e.composite_version_id IS NOT DISTINCT FROM ${waiver.versionTarget?.kind === "composite" ? waiver.versionTarget.id : null}
 )`
				: sql``;
			// One INSERT SELECT keeps authorization and exact target checks at the write boundary.
			// HTTP Drizzle supports atomic SQL statements, not interactive transactions.
			await db.execute(sql`
 INSERT INTO vfx_appearance_reviews (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
 SELECT ${record.id}, ${record.projectId}, ${record.assetFamilyId}, ${record.contractRevisionId}, ${JSON.stringify(record)}::text::jsonb, ${userId}
 FROM asset_families f JOIN project p ON p.id = f.project_id
 WHERE f.id = ${record.assetFamilyId} AND p.id = ${record.projectId} AND p.owner_user_id = ${userId}
 AND ${record.reviewedByUserId} = ${userId}
 AND EXISTS (SELECT 1 FROM project_specialized_profile_contracts a JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id WHERE a.project_id = p.id AND a.profile_id = 'visual_effect_projectile_shadow_mark' AND a.contract_revision_id = ${record.contractRevisionId} AND r.definition = ${JSON.stringify(record.contractSnapshot)}::text::jsonb)
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.versionPins)}::text::jsonb) pin WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id WHERE v.id = pin->>'assetVersionId' AND v.project_id = p.id AND v.content_digest = pin->>'contentDigest' AND v.integrity_verified = true AND ar.availability <> 'erased'))
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(record.frames)}::text::jsonb) frame WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id WHERE v.id = frame->>'assetVersionId' AND v.project_id = p.id AND v.asset_family_id = f.id AND ar.asset_category = 'visual_effect_projectile_shadow_mark' AND ar.availability <> 'erased'))
 ${waiverGuard}
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
