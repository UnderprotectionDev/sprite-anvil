import type { AssetVersionSourceKind } from "@sprite-anvil/api/asset-versions";
import type { Database } from "@sprite-anvil/db";
import { manualImportEvidence } from "@sprite-anvil/db/schema/asset-production-history";
import { and, eq } from "drizzle-orm";

export function isManualImportEvidenceRequired(
	sourceKind: AssetVersionSourceKind
) {
	return sourceKind === "manual_import";
}

export async function hasManualImportEvidence(
	db: Database,
	input: { assetRecordId: string; projectId: string; versionId: string }
) {
	const [evidence] = await db
		.select({ id: manualImportEvidence.id })
		.from(manualImportEvidence)
		.where(
			and(
				eq(manualImportEvidence.projectId, input.projectId),
				eq(manualImportEvidence.assetRecordId, input.assetRecordId),
				eq(manualImportEvidence.versionId, input.versionId)
			)
		)
		.limit(1);
	return Boolean(evidence);
}
