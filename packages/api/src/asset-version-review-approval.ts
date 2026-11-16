import { readAssetVersionApprovalBlockers } from "@sprite-anvil/api/asset-version-approval";
import type { AssetVersionApprovalBlocked } from "@sprite-anvil/api/asset-versions";
import {
	hasManualImportEvidence,
	isManualImportEvidenceRequired,
} from "@sprite-anvil/api/manual-import-evidence-gate";
import { createVersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import {
	toManagedSnapshot,
	toManualImportEvidence,
} from "@sprite-anvil/api/production-provenance-mapper";
import type { Database } from "@sprite-anvil/db";
import {
	legacyAssetAttestations,
	managedSnapshots,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";
import type { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { and, asc, eq } from "drizzle-orm";

export async function readVersionProductionEvidence(
	db: Database,
	record: typeof assetVersions.$inferSelect
) {
	const [manualRows, legacyRows, snapshotRows] = await Promise.all([
		db
			.select()
			.from(manualImportEvidence)
			.where(
				and(
					eq(manualImportEvidence.projectId, record.projectId),
					eq(manualImportEvidence.versionId, record.id)
				)
			)
			.orderBy(asc(manualImportEvidence.revision)),
		db
			.select({ id: legacyAssetAttestations.id })
			.from(legacyAssetAttestations)
			.where(
				and(
					eq(legacyAssetAttestations.projectId, record.projectId),
					eq(legacyAssetAttestations.versionId, record.id)
				)
			)
			.limit(1),
		db
			.select()
			.from(managedSnapshots)
			.where(
				and(
					eq(managedSnapshots.projectId, record.projectId),
					eq(managedSnapshots.assetVersionId, record.id)
				)
			)
			.orderBy(asc(managedSnapshots.createdAt), asc(managedSnapshots.id)),
	]);
	const latestManualEvidence = manualRows.at(-1);
	return createVersionProductionEvidence(
		legacyRows.length > 0 ? "legacy_asset" : record.sourceKind,
		latestManualEvidence ? toManualImportEvidence(latestManualEvidence) : null,
		snapshotRows.map(toManagedSnapshot)
	);
}

export async function checkReviewApproval(
	db: Database,
	userId: string,
	version: typeof assetVersions.$inferSelect
): Promise<true | AssetVersionApprovalBlocked | null> {
	if (!(version.integrityVerified && version.contentDigest)) {
		return null;
	}
	const productionEvidence = await readVersionProductionEvidence(db, version);
	if (productionEvidence.evidenceLevel === "incomplete") {
		return null;
	}
	if (
		isManualImportEvidenceRequired(version.sourceKind) &&
		!(await hasManualImportEvidence(db, {
			assetRecordId: version.assetRecordId,
			projectId: version.projectId,
			versionId: version.id,
		}))
	) {
		return null;
	}
	const blockers = await readAssetVersionApprovalBlockers(db, userId, version);
	return blockers.length > 0 ? { kind: "approval-blocked", blockers } : true;
}
