import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { TilesetAdjacencyReviewManager } from "./tileset-adjacency-review-manager";

export function TilesetAdjacencyReviewSections({
	activation,
	assetFamilies,
	assetFamilyRecords,
	assetRecords,
	catalog,
	projectId,
}: {
	activation: ProjectProfileContractActivation | null | undefined;
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetFamilyRecords: AssetFamilyCatalog["assetRecords"];
	assetRecords: AssetRecord[];
	catalog: AssetVersionCatalog;
	projectId: string;
}) {
	if (activation?.contract.profileId !== "tileset_terrain_texture") {
		return null;
	}
	return assetFamilies
		.filter((family) =>
			assetFamilyRecords.some(
				(record) =>
					record.assetFamilyId === family.id &&
					assetRecords.some(
						(asset) =>
							asset.id === record.id &&
							asset.assetCategory === "tileset_terrain_texture" &&
							asset.availability !== "erased"
					)
			)
		)
		.map((family) => (
			<TilesetAdjacencyReviewManager
				activation={activation}
				assetFamilyId={family.id}
				assetRecords={assetRecords.filter((asset) =>
					assetFamilyRecords.some(
						(record) =>
							record.id === asset.id && record.assetFamilyId === family.id
					)
				)}
				catalog={catalog}
				familyName={family.name}
				key={`${family.id}:${activation.contractRevisionId}`}
				projectId={projectId}
			/>
		));
}
