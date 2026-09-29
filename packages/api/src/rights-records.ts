import { z } from "zod";
import { assetSourceFileNameSchema } from "./asset-file-contracts";

export const rightsRecordEvidenceFileLimitBytes = 5 * 1024 * 1024;

export const rightsRecordStates = [
	"documented",
	"assertion_only",
	"unknown",
	"restricted",
] as const;

export const rightsRecordStateSchema = z.enum(rightsRecordStates);
export type RightsRecordState = z.infer<typeof rightsRecordStateSchema>;

const projectIdSchema = z.uuid();
const assetRecordIdSchema = z.uuid();
const rightsRecordIdSchema = z.uuid();
const rightsRecordEvidenceContentTypeSchema = z
	.string()
	.min(1)
	.max(127)
	.regex(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i);
const rightsRecordTextSchema = z
	.string()
	.trim()
	.max(5000)
	.nullable()
	.transform((value) => value || null);

export const rightsRecordEvidenceFileSchema = z
	.object({
		contentLength: z
			.number()
			.int()
			.positive()
			.max(rightsRecordEvidenceFileLimitBytes),
		fileName: assetSourceFileNameSchema,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sourceContentType: rightsRecordEvidenceContentTypeSchema,
	})
	.strict();
export type RightsRecordEvidenceFile = z.infer<
	typeof rightsRecordEvidenceFileSchema
>;

export const rightsRecordStoredEvidenceFileSchema =
	rightsRecordEvidenceFileSchema
		.extend({ objectKey: z.string().min(1) })
		.strict();
export type RightsRecordStoredEvidenceFile = z.infer<
	typeof rightsRecordStoredEvidenceFileSchema
>;

export const rightsRecordFieldsSchema = z
	.object({
		assetRecordId: assetRecordIdSchema,
		assertedScope: rightsRecordTextSchema,
		evidence: rightsRecordTextSchema,
		id: rightsRecordIdSchema,
		projectId: projectIdSchema,
		referenceId: rightsRecordIdSchema.nullable().optional(),
		restrictions: rightsRecordTextSchema,
		rightsHolderOrProvider: rightsRecordTextSchema,
		source: rightsRecordTextSchema,
		state: rightsRecordStateSchema,
		uncertainty: rightsRecordTextSchema,
	})
	.strict();

function validateRightsRecordState(
	record: {
		evidence: string | null;
		evidenceFile?: RightsRecordEvidenceFile | null;
		evidenceFileSourceRecordId?: string | null;
		restrictions: string | null;
		state: RightsRecordState;
	},
	context: z.RefinementCtx
) {
	if (
		record.state === "documented" &&
		!record.evidence &&
		!record.evidenceFile &&
		!record.evidenceFileSourceRecordId
	) {
		context.addIssue({
			code: "custom",
			path: ["evidence"],
			message: "Belgelendi durumunda destekleyici kanıt gerekir.",
		});
	}
	if (record.state === "restricted" && !record.restrictions) {
		context.addIssue({
			code: "custom",
			path: ["restrictions"],
			message: "Kısıtlı durumunda bilinen en az bir kısıt gerekir.",
		});
	}
}

export const rightsRecordSchema = z
	.object({
		assetRecordId: assetRecordIdSchema,
		assertedScope: rightsRecordTextSchema,
		createdAt: z.iso.datetime(),
		evidence: rightsRecordTextSchema,
		evidenceFile: rightsRecordEvidenceFileSchema.nullable(),
		id: rightsRecordIdSchema,
		projectId: projectIdSchema,
		referenceId: rightsRecordIdSchema.nullable().optional(),
		restrictions: rightsRecordTextSchema,
		rightsHolderOrProvider: rightsRecordTextSchema,
		source: rightsRecordTextSchema,
		state: rightsRecordStateSchema,
		uncertainty: rightsRecordTextSchema,
		versionNumber: z.number().int().positive(),
	})
	.strict()
	.superRefine(validateRightsRecordState);

export type RightsRecord = z.infer<typeof rightsRecordSchema>;

export const rightsRecordCreateInputSchema = rightsRecordFieldsSchema
	.extend({
		evidenceFileSourceRecordId: rightsRecordIdSchema.nullable().optional(),
	})
	.strict()
	.superRefine(validateRightsRecordState);

export type RightsRecordCreateInput = z.input<
	typeof rightsRecordCreateInputSchema
>;

export const rightsRecordEvidenceFileCreateInputSchema =
	rightsRecordFieldsSchema
		.extend({ evidenceFile: rightsRecordEvidenceFileSchema })
		.strict()
		.superRefine(validateRightsRecordState);

export type RightsRecordEvidenceFileCreateInput = z.infer<
	typeof rightsRecordEvidenceFileCreateInputSchema
>;

export type RightsRecordCreateResult =
	| { ok: true; record: RightsRecord }
	| { ok: false; reason: "conflict" | "not_found" };

export const rightsRecordListInputSchema = z
	.object({
		assetRecordId: assetRecordIdSchema,
		projectId: projectIdSchema,
		referenceId: rightsRecordIdSchema.nullable().optional(),
	})
	.strict();

export interface RightsRecordStore {
	canAccessAssetRecord: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<boolean>;
	canAccessReference: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		referenceId: string
	) => Promise<boolean>;
	createRevision: (
		userId: string,
		input: RightsRecordCreateInput
	) => Promise<RightsRecordCreateResult>;
	createRevisionWithEvidenceFile: (
		userId: string,
		input: RightsRecordEvidenceFileCreateInput & {
			evidenceFile: RightsRecordStoredEvidenceFile;
		}
	) => Promise<RightsRecordCreateResult>;
	getEvidenceFile: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		referenceId: string | null,
		rightsRecordId: string
	) => Promise<RightsRecordStoredEvidenceFile | null>;
	list: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		referenceId: string | null
	) => Promise<RightsRecord[] | null>;
}
