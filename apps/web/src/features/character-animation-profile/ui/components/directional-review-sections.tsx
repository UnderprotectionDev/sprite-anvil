import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { DirectionalReviewManager } from "./directional-review-manager";

export function DirectionalReviewSections({
	activation,
	assetFamilies,
	assetRecords,
	catalog,
	projectId,
}: {
	activation: ProjectProfileContractActivation | undefined;
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetRecords: AssetFamilyCatalog["assetRecords"];
	catalog: AssetVersionCatalog;
	projectId: string;
}) {
	if (!activation) {
		return null;
	}

	const recordNames = Object.fromEntries(
		assetRecords.map((record) => [record.id, record.name])
	);
	return assetFamilies.map((family) => (
		<DirectionalReviewManager
			activation={activation}
			assetFamilyId={family.id}
			catalog={catalog}
			familyName={family.name}
			key={family.id}
			projectId={projectId}
			recordNames={recordNames}
		/>
	));
}
