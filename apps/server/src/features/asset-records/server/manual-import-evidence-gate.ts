import type { AssetVersionSourceKind } from "@sprite-anvil/api/asset-versions";
import type { Database } from "@sprite-anvil/db";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { and, eq, lte } from "drizzle-orm";

function asTimestamp(value: Date | string) {
	return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function asDate(value: Date | string) {
	return value instanceof Date ? value : new Date(value);
}

export function isManualImportEvidenceRequired(
	sourceKind: AssetVersionSourceKind,
	versionCreatedAt: Date | string,
	generationPackageCreatedAt: readonly (Date | string)[]
) {
	if (sourceKind === "manual_import") {
		return true;
	}
	return (
		sourceKind === "legacy_asset" &&
		generationPackageCreatedAt.some(
			(packageCreatedAt) =>
				asTimestamp(packageCreatedAt) <= asTimestamp(versionCreatedAt)
		)
	);
}

export async function requiresManualImportEvidence(
	db: Database,
	version: {
		assetRecordId: string;
		createdAt: Date | string;
		projectId: string;
		sourceKind: AssetVersionSourceKind;
	}
) {
	if (version.sourceKind === "manual_import") {
		return true;
	}
	if (version.sourceKind !== "legacy_asset") {
		return false;
	}
	const [generationPackage] = await db
		.select({ id: generationPackages.id })
		.from(generationPackages)
		.where(
			and(
				eq(generationPackages.projectId, version.projectId),
				eq(generationPackages.assetRecordId, version.assetRecordId),
				lte(generationPackages.createdAt, asDate(version.createdAt))
			)
		)
		.limit(1);
	return Boolean(generationPackage);
}
