import { z } from "zod";
import { assetVersionFileNameSchema } from "./asset-file-contracts";

export const managedSnapshotSummarySchema = z
	.object({
		assetVersionId: z.uuid(),
		byteSize: z.number().int().positive(),
		createdAt: z.iso.datetime(),
		downloadUrl: z.string().min(1),
		fileName: assetVersionFileNameSchema,
		id: z.uuid(),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
export type ManagedSnapshot = z.infer<typeof managedSnapshotSummarySchema>;

export const productionSourceKindSchema = z.enum([
	"manual_import",
	"external_working_file_edit",
	"legacy_asset",
	"unknown",
]);

export const productionEvidenceLevelSchema = z.enum([
	"complete",
	"incomplete",
	"unknown",
]);

export const manualImportEvidenceSummarySchema = z
	.object({
		actualInstruction: z.string().min(1).max(20_000),
		generationPackageId: z.uuid(),
		id: z.uuid(),
		recordedAt: z.iso.datetime(),
		revision: z.number().int().positive(),
		sourceSurface: z.string().min(1).max(120),
	})
	.strict();
export type ManualImportEvidence = z.infer<
	typeof manualImportEvidenceSummarySchema
>;

export const manualImportEvidenceInputSchema = z
	.object({
		actualInstruction: z
			.string()
			.min(1)
			.max(20_000)
			.refine((value) => value.trim().length > 0),
		assetRecordId: z.uuid(),
		generationPackageId: z.uuid(),
		projectId: z.uuid(),
		sourceSurface: z.string().trim().min(1).max(120),
		versionId: z.uuid(),
	})
	.strict();
export type ManualImportEvidenceInput = z.infer<
	typeof manualImportEvidenceInputSchema
>;

export const versionProductionEvidenceSchema = z
	.object({
		evidenceLevel: productionEvidenceLevelSchema,
		managedSnapshots: managedSnapshotSummarySchema.array(),
		manualImportEvidence: manualImportEvidenceSummarySchema.nullable(),
		sourceKind: productionSourceKindSchema,
	})
	.strict();
export type VersionProductionEvidence = z.infer<
	typeof versionProductionEvidenceSchema
>;

export function createVersionProductionEvidence(
	sourceKind: VersionProductionEvidence["sourceKind"],
	manualImportEvidence: ManualImportEvidence | null = null,
	managedSnapshots: ManagedSnapshot[] = []
): VersionProductionEvidence {
	let evidenceLevel: VersionProductionEvidence["evidenceLevel"] = "unknown";
	if (sourceKind === "manual_import") {
		evidenceLevel = manualImportEvidence ? "complete" : "incomplete";
	} else if (sourceKind === "external_working_file_edit") {
		evidenceLevel = managedSnapshots.length > 0 ? "complete" : "incomplete";
	}
	return versionProductionEvidenceSchema.parse({
		evidenceLevel,
		managedSnapshots,
		manualImportEvidence,
		sourceKind,
	});
}

export interface ManagedSnapshotFileRecord extends ManagedSnapshot {
	assetRecordId: string;
	objectKey: string;
	projectId: string;
}

export interface ManagedSnapshotCreateInput {
	assetRecordId: string;
	assetVersionId: string;
	byteSize: number;
	fileName: string;
	id: string;
	idempotencyKey: string;
	objectKey: string;
	projectId: string;
	sha256: string;
}

export type ManagedSnapshotCreateResult =
	| { kind: "created" | "existing"; snapshot: ManagedSnapshot }
	| { kind: "idempotency-conflict" };

export interface ManagedSnapshotStore {
	create: (
		userId: string,
		input: ManagedSnapshotCreateInput
	) => Promise<ManagedSnapshotCreateResult | null>;
	getAssetVersionForUser: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<{ assetRecordId: string } | null>;
	getFileRecord: (
		userId: string,
		projectId: string,
		snapshotId: string
	) => Promise<ManagedSnapshotFileRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetVersionId: string
	) => Promise<ManagedSnapshot[] | null>;
}
