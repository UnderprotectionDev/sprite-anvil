import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { AssetFamilyComparisonManager } from "./asset-family-comparison-manager";

export function AssetFamilyComparisonSections({
	activation,
	assetRecordDetails,
	catalog,
	projectId,
	versionCatalog,
}: {
	activation: ProjectProfileContractActivation | undefined;
	assetRecordDetails: AssetRecord[] | undefined;
	catalog: AssetFamilyCatalog;
	projectId: string;
	versionCatalog: AssetVersionCatalog;
}) {
	if (!(activation && assetRecordDetails)) {
		return null;
	}

	const assetRecordDetailsById = new Map(
		assetRecordDetails.map((record) => [record.id, record])
	);
	return catalog.assetFamilies.map((family) => (
		<AssetFamilyComparisonManager
			activation={activation}
			assetFamilyId={family.id}
			assetRecords={catalog.assetRecords
				.filter((record) => record.assetFamilyId === family.id)
				.flatMap((record) => {
					const details = assetRecordDetailsById.get(record.id);
					return details
						? [
								{
									...record,
									assetCategory: details.assetCategory ?? null,
									availability: details.availability,
								},
							]
						: [];
				})}
			catalog={versionCatalog}
			familyName={family.name}
			key={family.id}
			projectId={projectId}
		/>
	));
}
