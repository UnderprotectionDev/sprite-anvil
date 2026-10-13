import type { UiStateComparisonManagerProps } from "./ui-state-comparison-manager";
import { UiStateComparisonManager } from "./ui-state-comparison-manager";

interface UiStateComparisonSectionsProps {
	activation?: UiStateComparisonManagerProps["activation"];
	assetFamilies: readonly { id: string; name: string }[];
	assetFamilyRecords: readonly { assetFamilyId: string; id: string }[];
	assetRecordsById: ReadonlyMap<
		string,
		UiStateComparisonManagerProps["assetRecords"][number]
	>;
	projectId: string;
	units: UiStateComparisonManagerProps["units"];
	versions: UiStateComparisonManagerProps["versions"];
}

export function UiStateComparisonSections({
	activation,
	assetFamilies,
	assetFamilyRecords,
	assetRecordsById,
	projectId,
	versions,
	units,
}: UiStateComparisonSectionsProps) {
	if (activation?.contract.profileId !== "ui") {
		return null;
	}

	return assetFamilies.map((family) => {
		const assetRecords = assetFamilyRecords
			.filter((record) => record.assetFamilyId === family.id)
			.map((record) => assetRecordsById.get(record.id))
			.filter(
				(
					record
				): record is UiStateComparisonManagerProps["assetRecords"][number] =>
					record !== undefined
			);
		return (
			<UiStateComparisonManager
				activation={activation}
				assetFamilyId={family.id}
				assetRecords={assetRecords}
				familyName={family.name}
				key={family.id}
				projectId={projectId}
				units={units}
				versions={versions}
			/>
		);
	});
}
