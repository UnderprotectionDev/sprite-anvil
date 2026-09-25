import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import { assetRecordSchema } from "@sprite-anvil/api/asset-records";
import type { assetRecords } from "@sprite-anvil/db/schema/asset-records";

export function toAssetRecord(
	row: typeof assetRecords.$inferSelect,
	familyVisualWorldId: string | null = null
): AssetRecord {
	return assetRecordSchema.parse({
		assetCategory: row.assetCategory ?? null,
		availability: row.availability,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		identityCriteria: row.identityCriteria ?? [],
		name: row.name,
		projectId: row.projectId,
		supportLevel: row.supportLevel,
		tags: row.tags ?? [],
		themeId: row.themeId ?? null,
		visualWorldId: row.visualWorldId ?? familyVisualWorldId,
	});
}
