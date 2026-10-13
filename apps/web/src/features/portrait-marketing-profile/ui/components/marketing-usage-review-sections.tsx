import type { AssetFamilyRecord } from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { MarketingUsageReviewManager } from "./marketing-usage-review-manager";
export function MarketingUsageReviewSections({
	activation,
	projectId,
	families,
	records,
	catalog,
}: {
	activation?: ProjectProfileContractActivation;
	projectId: string;
	families: AssetFamilyRecord[];
	records: AssetRecord[];
	catalog: AssetVersionCatalog;
}) {
	if (activation?.contract.profileId !== "portrait_logo_marketing") {
		return null;
	}
	const recordIds = new Set(
		records
			.filter(
				(record) =>
					record.assetCategory === "portrait_logo_marketing" &&
					record.availability !== "erased"
			)
			.map((record) => record.id)
	);
	return families.map((family) => {
		const versions = catalog.assetVersions.filter(
			(version) =>
				version.assetFamilyId === family.id &&
				recordIds.has(version.assetRecordId) &&
				version.integrityVerified &&
				version.contentDigest &&
				version.sourceImageDimensions
		);
		if (!versions.length) {
			return null;
		}
		const canonicalDesignId =
			catalog.canonicalDesigns
				.filter((design) => design.assetFamilyId === family.id)
				.at(-1)?.id ?? null;
		return (
			<MarketingUsageReviewManager
				activation={activation}
				canonicalDesignId={canonicalDesignId}
				family={family}
				key={`${family.id}:${canonicalDesignId}:${activation.contractRevisionId}`}
				projectId={projectId}
				versions={versions}
			/>
		);
	});
}
