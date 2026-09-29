import { z } from "zod";

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
const rightsRecordTextSchema = z
	.string()
	.trim()
	.max(5000)
	.nullable()
	.transform((value) => value || null);

function validateRightsRecordState(
	record: {
		evidence: string | null;
		restrictions: string | null;
		state: RightsRecordState;
	},
	context: z.RefinementCtx
) {
	if (record.state === "documented" && !record.evidence) {
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
		id: rightsRecordIdSchema,
		projectId: projectIdSchema,
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

export const rightsRecordCreateInputSchema = z
	.object({
		assetRecordId: assetRecordIdSchema,
		assertedScope: rightsRecordTextSchema,
		evidence: rightsRecordTextSchema,
		id: rightsRecordIdSchema,
		projectId: projectIdSchema,
		restrictions: rightsRecordTextSchema,
		rightsHolderOrProvider: rightsRecordTextSchema,
		source: rightsRecordTextSchema,
		state: rightsRecordStateSchema,
		uncertainty: rightsRecordTextSchema,
	})
	.strict()
	.superRefine(validateRightsRecordState);

export type RightsRecordCreateInput = z.input<
	typeof rightsRecordCreateInputSchema
>;

export type RightsRecordCreateResult =
	| { ok: true; record: RightsRecord }
	| { ok: false; reason: "conflict" | "not_found" };

export const rightsRecordListInputSchema = z
	.object({
		assetRecordId: assetRecordIdSchema,
		projectId: projectIdSchema,
	})
	.strict();

export interface RightsRecordStore {
	createRevision: (
		userId: string,
		input: RightsRecordCreateInput
	) => Promise<RightsRecordCreateResult>;
	list: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<RightsRecord[] | null>;
}
