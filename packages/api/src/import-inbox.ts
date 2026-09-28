import { z } from "zod";
import { assetSourceFileNameSchema } from "./asset-record-tracking";

export const importInboxSourceContentTypeSchema = z
	.string()
	.min(1)
	.max(127)
	.regex(/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i);

export const importInboxEntrySchema = z
	.object({
		createdAt: z.iso.datetime(),
		contentLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		fileName: assetSourceFileNameSchema,
		id: z.uuid(),
		projectId: z.uuid(),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sourceContentType: importInboxSourceContentTypeSchema,
	})
	.strict();
export type ImportInboxEntry = z.infer<typeof importInboxEntrySchema>;

export const importInboxEntriesSchema = z.array(importInboxEntrySchema);

export const importInboxUploadInputSchema = z
	.object({
		contentLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		fileName: assetSourceFileNameSchema,
		id: z.uuid(),
		objectKey: z.string().min(1),
		projectId: z.uuid(),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sourceContentType: importInboxSourceContentTypeSchema,
	})
	.strict();
export type ImportInboxUploadInput = z.infer<
	typeof importInboxUploadInputSchema
>;

export interface ImportInboxFileRecord {
	contentLength: number;
	fileName: string;
	objectKey: string;
	sha256: string;
}

export type ImportInboxCreateResult =
	| {
			kind: "created" | "existing";
			ok: true;
			value: ImportInboxEntry;
	  }
	| {
			ok: false;
			reason: "conflict" | "not_found";
	  };

export interface ImportInboxStore {
	createEntry: (
		userId: string,
		input: ImportInboxUploadInput
	) => Promise<ImportInboxCreateResult>;
	getFileRecord: (
		userId: string,
		projectId: string,
		entryId: string
	) => Promise<ImportInboxFileRecord | null>;
	listEntries: (
		userId: string,
		projectId: string
	) => Promise<ImportInboxEntry[] | null>;
}
