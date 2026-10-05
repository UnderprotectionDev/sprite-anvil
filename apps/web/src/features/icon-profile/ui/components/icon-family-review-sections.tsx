import type { IconFamilyReviewManagerProps } from "./icon-family-review-manager";
import { IconFamilyReviewManager } from "./icon-family-review-manager";

interface IconFamilyReviewSectionsProps {
	activation?: IconFamilyReviewManagerProps["activation"];
	assetFamilies: readonly { id: string; name: string }[];
	assetFamilyRecords: readonly { assetFamilyId: string; id: string }[];
	assetRecordsById: ReadonlyMap<
		string,
		IconFamilyReviewManagerProps["assetRecords"][number]
	>;
	projectId: string;
	versions: IconFamilyReviewManagerProps["versions"];
}

export function IconFamilyReviewSections({
	activation,
	assetFamilies,
	assetFamilyRecords,
	assetRecordsById,
	projectId,
	versions,
}: IconFamilyReviewSectionsProps) {
	if (activation?.contract.profileId !== "icon") {
		return null;
	}

	return assetFamilies.map((family) => {
		const assetRecords = assetFamilyRecords
			.filter((record) => record.assetFamilyId === family.id)
			.map((record) => assetRecordsById.get(record.id))
			.filter(
				(
					record
				): record is IconFamilyReviewManagerProps["assetRecords"][number] =>
					record !== undefined
			);
		return (
			<IconFamilyReviewManager
				activation={activation}
				assetFamilyId={family.id}
				assetRecords={assetRecords}
				familyName={family.name}
				key={family.id}
				projectId={projectId}
				versions={versions}
			/>
		);
	});
}
