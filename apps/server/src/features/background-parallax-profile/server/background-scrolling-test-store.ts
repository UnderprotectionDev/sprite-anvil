import { isDeepStrictEqual } from "node:util";
import {
	type BackgroundScrollingTestStore,
	backgroundScrollingTestRecordSchema,
} from "@sprite-anvil/api/background-scrolling-tests";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { backgroundScrollingTests } from "@sprite-anvil/db/schema/background-scrolling-tests";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { createBackgroundLayerLayoutStore } from "./background-layer-layout-store";

export function createBackgroundScrollingTestStore(
	db: Database
): BackgroundScrollingTestStore {
	const layouts = createBackgroundLayerLayoutStore(db);
	const store: BackgroundScrollingTestStore = {
		async list(userId, projectId, assetFamilyId) {
			const accessibleLayouts = await layouts.list(
				userId,
				projectId,
				assetFamilyId
			);
			if (!accessibleLayouts) {
				return null;
			}
			const players = await db
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
				);
			const playerIds = new Set(players.map((player) => player.id));
			const layoutIds = new Set(accessibleLayouts.map((layout) => layout.id));
			const rows = await db
				.select()
				.from(backgroundScrollingTests)
				.where(
					and(
						eq(backgroundScrollingTests.projectId, projectId),
						eq(backgroundScrollingTests.assetFamilyId, assetFamilyId)
					)
				)
				.orderBy(
					desc(backgroundScrollingTests.createdAt),
					desc(backgroundScrollingTests.id)
				);
			return rows
				.map((row) => backgroundScrollingTestRecordSchema.parse(row.record))
				.filter(
					(record) =>
						layoutIds.has(record.setup.layoutId) &&
						playerIds.has(record.playerPin.assetVersionId)
				);
		},
		async append(userId, rawRecord) {
			const record = backgroundScrollingTestRecordSchema.parse(rawRecord);
			await db.execute(sql`
INSERT INTO background_scrolling_tests (id, project_id, asset_family_id, contract_revision_id, record, created_by_user_id)
SELECT ${record.id}, p.id, l.asset_family_id, l.contract_revision_id, ${JSON.stringify(record)}::text::jsonb, ${userId}
FROM background_layer_layouts l JOIN project p ON p.id = l.project_id
JOIN asset_families f ON f.id = l.asset_family_id AND f.project_id = p.id
WHERE p.id = ${record.projectId} AND p.owner_user_id = ${userId}
AND ${record.createdByUserId} = ${userId} AND l.asset_family_id = ${record.assetFamilyId}
AND l.id = ${record.setup.layoutId} AND l.record = ${JSON.stringify(record.layoutSnapshot)}::text::jsonb
AND f.visual_world_id = ${record.layoutSnapshot.visualWorldId}
AND EXISTS (SELECT 1 FROM project_specialized_profile_contracts a
 JOIN specialized_profile_contract_revisions r ON r.id = a.contract_revision_id
 WHERE a.project_id = p.id AND a.profile_id = 'background_parallax'
 AND a.contract_revision_id = l.contract_revision_id AND r.definition = l.record->'contractSnapshot')
AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l.record->'versionPins') pin
 WHERE NOT EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id
 WHERE v.id = pin->>'assetVersionId' AND v.project_id = p.id AND v.asset_family_id = f.id
 AND v.content_digest = pin->>'contentDigest' AND v.integrity_verified = true AND ar.availability <> 'erased'
 AND v.source_image_width = (pin->'naturalSize'->>'width')::integer
 AND v.source_image_height = (pin->'naturalSize'->>'height')::integer))
AND EXISTS (SELECT 1 FROM asset_versions v JOIN asset_records ar ON ar.id = v.asset_record_id
 WHERE v.id = ${record.playerPin.assetVersionId} AND v.project_id = p.id
 AND ar.id = ${record.playerPin.assetRecordId} AND ar.availability <> 'erased'
 AND ar.asset_category = 'character_creature_animation' AND v.integrity_verified = true
 AND v.content_digest = ${record.playerPin.contentDigest} AND v.version_number = ${record.playerPin.versionNumber}
 AND ar.name = ${record.playerPin.assetRecordName}
 AND v.source_image_width = ${record.playerPin.width} AND v.source_image_height = ${record.playerPin.height})
ON CONFLICT DO NOTHING`);
			const records = await store.list(
				userId,
				record.projectId,
				record.assetFamilyId
			);
			const saved = records?.find((candidate) => candidate.id === record.id);
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
