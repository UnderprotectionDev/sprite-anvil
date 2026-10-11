import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { VfxSynchronizationManager } from "./vfx-synchronization-manager";
export function VfxSynchronizationSections({
	activation,
	projectId,
	catalog,
	assetFamilies,
	recordNames,
	categories,
}: {
	activation?: ProjectProfileContractActivation;
	projectId: string;
	catalog: AssetVersionCatalog;
	assetFamilies: { id: string; name: string }[];
	recordNames: Record<string, string>;
	categories: Record<string, string | null>;
}) {
	if (!activation) {
		return null;
	}
	return assetFamilies
		.filter((family) =>
			catalog.assetVersions.some(
				(version) =>
					version.assetFamilyId === family.id &&
					categories[version.assetRecordId] ===
						"visual_effect_projectile_shadow_mark"
			)
		)
		.map((family) => (
			<VfxSynchronizationManager
				activation={activation}
				assetFamilyId={family.id}
				catalog={catalog}
				categories={categories}
				familyName={family.name}
				key={family.id}
				projectId={projectId}
				recordNames={recordNames}
			/>
		));
}
