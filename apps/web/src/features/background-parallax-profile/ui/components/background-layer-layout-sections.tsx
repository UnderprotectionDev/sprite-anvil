import type { BackgroundLayerLayoutManagerProps } from "./background-layer-layout-manager";
import { BackgroundLayerLayoutManager } from "./background-layer-layout-manager";

interface Props {
	activation?: BackgroundLayerLayoutManagerProps["activation"];
	assetRecords: BackgroundLayerLayoutManagerProps["assetRecords"];
	families: readonly { id: string; name: string; visualWorldId: string }[];
	familyRecords: readonly { id: string; assetFamilyId: string | null }[];
	projectId: string;
	versions: BackgroundLayerLayoutManagerProps["versions"];
}
export function BackgroundLayerLayoutSections({
	activation,
	projectId,
	families,
	familyRecords,
	assetRecords,
	versions,
}: Props) {
	if (activation?.contract.profileId !== "background_parallax") {
		return null;
	}
	const backgroundRecordIds = new Set(
		assetRecords
			.filter((record) => record.assetCategory === "background_parallax")
			.map((record) => record.id)
	);
	const backgroundFamilyIds = new Set(
		familyRecords
			.filter((record) => backgroundRecordIds.has(record.id))
			.map((record) => record.assetFamilyId)
	);
	return families
		.filter((family) => backgroundFamilyIds.has(family.id))
		.map((family) => (
			<BackgroundLayerLayoutManager
				activation={activation}
				assetFamilyId={family.id}
				assetRecords={assetRecords}
				familyName={family.name}
				key={family.id}
				projectId={projectId}
				versions={versions}
				visualWorldId={family.visualWorldId}
			/>
		));
}
