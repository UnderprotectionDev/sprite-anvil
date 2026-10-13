import type { UiStretchTestManagerProps } from "./ui-stretch-test-manager";
import { UiStretchTestManager } from "./ui-stretch-test-manager";

interface Props {
	activation?: UiStretchTestManagerProps["activation"];
	assetRecords: UiStretchTestManagerProps["assetRecords"];
	families: readonly { id: string; name: string; visualWorldId: string }[];
	familyRecords: readonly { id: string; assetFamilyId: string | null }[];
	projectId: string;
	versions: UiStretchTestManagerProps["versions"];
}
export function UiStretchTestSections({
	activation,
	projectId,
	families,
	familyRecords,
	assetRecords,
	versions,
}: Props) {
	if (activation?.contract.profileId !== "ui") {
		return null;
	}
	const uiRecordIds = new Set(
		assetRecords
			.filter((record) => record.assetCategory === "ui")
			.map((record) => record.id)
	);
	const uiFamilyIds = new Set(
		familyRecords
			.filter((record) => uiRecordIds.has(record.id))
			.map((record) => record.assetFamilyId)
	);
	return families
		.filter((family) => uiFamilyIds.has(family.id))
		.map((family) => (
			<UiStretchTestManager
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
