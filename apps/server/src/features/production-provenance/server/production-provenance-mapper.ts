import type {
	ManagedSnapshot,
	ManualImportEvidence,
} from "@sprite-anvil/api/production-provenance";
import {
	managedSnapshotSummarySchema,
	manualImportEvidenceSummarySchema,
} from "@sprite-anvil/api/production-provenance";
import type {
	managedSnapshots,
	manualImportEvidence,
} from "@sprite-anvil/db/schema/asset-production-history";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

export function toManagedSnapshot(
	record: typeof managedSnapshots.$inferSelect
): ManagedSnapshot {
	return managedSnapshotSummarySchema.parse({
		assetVersionId: record.assetVersionId,
		byteSize: record.byteSize,
		createdAt: toISOString(record.createdAt),
		downloadUrl: `/api/projects/${encodeURIComponent(record.projectId)}/managed-snapshots/${record.id}/content`,
		fileName: record.fileName,
		id: record.id,
		sha256: record.sha256,
	});
}

export function toManualImportEvidence(
	record: typeof manualImportEvidence.$inferSelect
): ManualImportEvidence {
	return manualImportEvidenceSummarySchema.parse({
		actualInstruction: record.generationInstruction,
		generationPackageId: record.generationPackageId,
		id: record.id,
		recordedAt: toISOString(record.createdAt),
		revision: record.revision,
		sourceSurface: record.sourceSurface,
	});
}
