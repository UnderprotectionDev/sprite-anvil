import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { VfxAppearanceReviewManager } from "./vfx-appearance-review-manager";

export function VfxAppearanceSections({
	activation,
	catalog,
	versionCatalog,
	assetRecords,
	projectId,
}: {
	activation?: ProjectProfileContractActivation;
	catalog: AssetFamilyCatalog;
	versionCatalog: AssetVersionCatalog;
	assetRecords: AssetRecord[];
	projectId: string;
}) {
	if (!activation) {
		return null;
	}
	const effectIds = new Set(
		assetRecords
			.filter(
				(record) =>
					record.assetCategory === "visual_effect_projectile_shadow_mark"
			)
			.map((record) => record.id)
	);
	return catalog.assetFamilies
		.filter((family) =>
			catalog.assetRecords.some(
				(record) =>
					record.assetFamilyId === family.id && effectIds.has(record.id)
			)
		)
		.map((family) => (
			<VfxAppearanceReviewManager
				activation={activation}
				assetFamilyId={family.id}
				assetRecords={assetRecords}
				catalog={versionCatalog}
				familyName={family.name}
				key={family.id}
				projectId={projectId}
			/>
		));
}
