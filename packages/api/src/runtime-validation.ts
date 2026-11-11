import { z } from "zod";
import { assetSourceFileNameSchema } from "./asset-file-contracts";
import { sha256Schema } from "./export-bundle-manifest";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

/** Evidence files reuse the Rights Record evidence upload path and its 5 MiB limit. */
export const runtimeValidationEvidenceFileLimitBytes = 5 * 1024 * 1024;
export const runtimeValidationEvidenceTextLimit = 10_000;

export const runtimeValidationEvidenceKinds = [
	"screenshot",
	"recording",
	"test_result",
	"observation",
] as const;
export const runtimeValidationEvidenceKindSchema = z.enum(
	runtimeValidationEvidenceKinds
);
export type RuntimeValidationEvidenceKind = z.infer<
	typeof runtimeValidationEvidenceKindSchema
>;

/** Whether the user attached the evidence or a verified adapter drafted it. */
export const runtimeValidationEvidenceSources = [
	"manual",
	"adapter_draft",
] as const;
export const runtimeValidationEvidenceSourceSchema = z.enum(
	runtimeValidationEvidenceSources
);
export type RuntimeValidationEvidenceSource = z.infer<
	typeof runtimeValidationEvidenceSourceSchema
>;

/** Observations are text only; a test result is text or a file. */
export const runtimeValidationTextEvidenceKindSchema = z.enum([
	"test_result",
	"observation",
]);
/** Screenshots and recordings are files; a test result may also be a file. */
export const runtimeValidationFileEvidenceKindSchema = z.enum([
	"screenshot",
	"recording",
	"test_result",
]);

const requiredTextSchema = z.string().trim().min(1).max(200);

export const runtimeValidationRecordCreateInputSchema = z
	.object({
		/** Verified Engine Adapter version used in the test; optional. */
		adapterVersion: requiredTextSchema.nullable().default(null),
		/** The exact Export Bundle under test. */
		bundleId: idSchema,
		engineVersion: requiredTextSchema,
		gameBuild: requiredTextSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
	})
	.strict();
export type RuntimeValidationRecordCreateInput = z.infer<
	typeof runtimeValidationRecordCreateInputSchema
>;

export const runtimeValidationTextEvidenceInputSchema = z
	.object({
		idempotencyKey: idempotencyKeySchema,
		kind: runtimeValidationTextEvidenceKindSchema,
		projectId: idSchema,
		recordId: idSchema,
		source: runtimeValidationEvidenceSourceSchema,
		text: z.string().trim().min(1).max(runtimeValidationEvidenceTextLimit),
	})
	.strict();
export type RuntimeValidationTextEvidenceInput = z.infer<
	typeof runtimeValidationTextEvidenceInputSchema
>;

export const runtimeValidationEvidenceFileSchema = z.object({
	byteSize: z
		.number()
		.int()
		.positive()
		.max(runtimeValidationEvidenceFileLimitBytes),
	fileName: assetSourceFileNameSchema,
	sha256: sha256Schema,
});
export type RuntimeValidationEvidenceFile = z.infer<
	typeof runtimeValidationEvidenceFileSchema
>;

/** The file as stored: its R2 object key stays server-side. */
export interface RuntimeValidationStoredEvidenceFile
	extends RuntimeValidationEvidenceFile {
	objectKey: string;
}

export interface RuntimeValidationFileEvidenceInput {
	file: RuntimeValidationStoredEvidenceFile;
	idempotencyKey: string;
	kind: z.infer<typeof runtimeValidationFileEvidenceKindSchema>;
	projectId: string;
	recordId: string;
	source: RuntimeValidationEvidenceSource;
}

export const runtimeValidationEvidenceSchema = z.object({
	createdAt: z.iso.datetime(),
	/** Exactly one of `file` and `text` is set. */
	file: runtimeValidationEvidenceFileSchema.nullable(),
	id: idSchema,
	kind: runtimeValidationEvidenceKindSchema,
	source: runtimeValidationEvidenceSourceSchema,
	text: z.string().nullable(),
});
export type RuntimeValidationEvidence = z.infer<
	typeof runtimeValidationEvidenceSchema
>;

/** A Runtime Validation Record re-read from its persisted rows, evidence in the order it was added. */
export const runtimeValidationRecordSchema = z.object({
	adapterVersion: z.string().nullable(),
	bundleId: idSchema,
	createdAt: z.iso.datetime(),
	engineVersion: z.string(),
	evidence: z.array(runtimeValidationEvidenceSchema),
	gameBuild: z.string(),
	id: idSchema,
	/** Manifest digest of the bundle, copied when the record was written. */
	manifestDigest: sha256Schema,
	projectId: idSchema,
});
export type RuntimeValidationRecord = z.infer<
	typeof runtimeValidationRecordSchema
>;

export const runtimeValidationRecordGetInputSchema = z
	.object({ projectId: idSchema, recordId: idSchema })
	.strict();

export const runtimeValidationRecordListInputSchema = z
	.object({ bundleId: idSchema.optional(), projectId: idSchema })
	.strict();

export const runtimeValidationRecordListSchema = z.object({
	records: z.array(runtimeValidationRecordSchema),
});
export type RuntimeValidationRecordList = z.infer<
	typeof runtimeValidationRecordListSchema
>;
