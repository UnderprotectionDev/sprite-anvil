import { z } from "zod";
import { pixelEditorMaxOperations, pixelOperationSchema } from "./pixel-editor";

/**
 * Offline Conflict Record contract. When a Working Draft staged offline meets a
 * cloud draft that moved on, the server keeps three immutable versions side by
 * side: the pinned base, the current cloud draft and the local Working Draft.
 * The cloud stays authoritative; nothing here merges fields or picks a winner.
 *
 * A record carries its own full contract version. A reader stops on an unknown
 * major version or on a field the record lists in `requires` that it does not
 * know; unknown optional fields are tolerated and preserved with the record.
 */

export const offlineConflictContractVersion = "offline-conflict/1.0.0";
export const offlineConflictSupportedMajor = 1;

/** Fields this reader understands; a record may require any of them. */
export const offlineConflictKnownFields = [
	"contractVersion",
	"requires",
	"base",
	"cloud",
	"local",
] as const;

const versionPattern = /^offline-conflict\/(\d+)\.(\d+)\.(\d+)$/;

const revisionSchema = z.number().int().min(0);
const operationsSchema = z
	.array(pixelOperationSchema)
	.max(pixelEditorMaxOperations);

const offlineConflictBaseSchema = z.looseObject({
	revision: revisionSchema,
	sourceAssetVersionId: z.uuid(),
});

export const offlineConflictLocalSchema = z
	.looseObject({
		operations: operationsSchema,
		appliedOperationCount: z.number().int().min(0),
	})
	.refine((local) => local.appliedOperationCount <= local.operations.length, {
		message: "appliedOperationCount exceeds the operations",
		path: ["appliedOperationCount"],
	});

const offlineConflictCloudSchema = z.looseObject({
	revision: revisionSchema,
	status: z.enum(["open", "committed", "discarded"]),
	sourceAssetVersionId: z.uuid(),
	committedAssetVersionId: z.uuid().nullable(),
	operations: operationsSchema,
	appliedOperationCount: z.number().int().min(0),
});

/** The stored content of an Offline Conflict Record, tolerant of unknown optional fields. */
export const offlineConflictContentSchema = z.looseObject({
	contractVersion: z.string(),
	requires: z.array(z.string()).default([]),
	base: offlineConflictBaseSchema,
	cloud: offlineConflictCloudSchema,
	local: offlineConflictLocalSchema,
});

export type OfflineConflictContent = z.infer<
	typeof offlineConflictContentSchema
>;

export type OfflineConflictParseResult =
	| { content: OfflineConflictContent; ok: true }
	| { message: string; ok: false; reason: "invalid" | "unsupported" };

function readMajor(contractVersion: unknown): number | null {
	if (typeof contractVersion !== "string") {
		return null;
	}
	const match = versionPattern.exec(contractVersion);
	return match ? Number(match[1]) : null;
}

/** Stops on an unreadable or unknown-major contract version; any minor is compatible. */
export function checkOfflineConflictContractVersion(
	declared: unknown
):
	| { ok: true }
	| { message: string; ok: false; reason: "invalid" | "unsupported" } {
	const major = readMajor(declared);
	if (major === null) {
		return {
			ok: false,
			reason: "invalid",
			message: "The record has no readable contract version.",
		};
	}
	if (major !== offlineConflictSupportedMajor) {
		return {
			ok: false,
			reason: "unsupported",
			message: `Contract version ${String(declared)} is not supported; this reader understands offline-conflict/${offlineConflictSupportedMajor}.x.`,
		};
	}
	return { ok: true };
}

/**
 * Reads a stored record. Stops with a descriptive reason on an unknown major
 * version or a required field this reader does not know; everything else that
 * is unknown is kept in the returned content and ignored.
 */
export function parseOfflineConflictContent(
	raw: unknown
): OfflineConflictParseResult {
	const version = checkOfflineConflictContractVersion(
		typeof raw === "object" && raw !== null
			? (raw as { contractVersion?: unknown }).contractVersion
			: undefined
	);
	if (!version.ok) {
		return version;
	}
	const parsed = offlineConflictContentSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "invalid",
			message: `The record is malformed: ${parsed.error.issues[0]?.path.join(".") || "content"}.`,
		};
	}
	const known = new Set<string>(offlineConflictKnownFields);
	const unknownRequired = parsed.data.requires.filter(
		(field) => !known.has(field)
	);
	if (unknownRequired.length > 0) {
		return {
			ok: false,
			reason: "unsupported",
			message: `The record requires fields this reader does not know: ${unknownRequired.join(", ")}.`,
		};
	}
	return { ok: true, content: parsed.data };
}

export const offlineConflictChoices = [
	"create-candidate",
	"keep-cloud-retain-draft",
	"abandon",
] as const;

export const offlineConflictChoiceSchema = z.enum(offlineConflictChoices);

/** Reconnect check input: the staged draft's pinned base plus its local content. */
export const offlineReconcileInputSchema = z.looseObject({
	contractVersion: z.string(),
	draftId: z.uuid(),
	base: offlineConflictBaseSchema,
	local: offlineConflictLocalSchema,
});

export const offlineConflictResolveInputSchema = z
	.object({
		/** Checked like the record's own contract version: an unknown major stops resolution. */
		contractVersion: z.string(),
		idempotencyKey: z.uuid(),
		choice: offlineConflictChoiceSchema,
		/**
		 * Abandoning is irreversible: both fields must be sent. The token comes from
		 * the abandon-confirmation step, which serves the affected local content.
		 */
		confirmAbandon: z.boolean().optional(),
		confirmationToken: z.string().min(1).max(512).optional(),
	})
	.strict();

/** What abandoning would discard, served together with the token that confirms it. */
export const offlineAbandonConfirmationSchema = z
	.object({
		conflictId: z.uuid(),
		localDigest: z.string().min(1),
		operationCount: z.number().int().min(0),
		appliedOperationCount: z.number().int().min(0),
		operations: z.array(
			z.object({ type: z.string(), count: z.number().int().min(1) }).strict()
		),
		confirmationToken: z.string().min(1),
		expiresAt: z.iso.datetime(),
	})
	.strict();

export const offlineConflictResolutionSchema = z
	.object({
		id: z.uuid(),
		choice: offlineConflictChoiceSchema,
		resolvedAt: z.iso.datetime(),
		resolvedByUserId: z.string().min(1),
		resultAssetVersionId: z.uuid().nullable(),
		idempotencyKey: z.uuid(),
	})
	.strict();

export const offlineConflictViewSchema = z
	.object({
		id: z.uuid(),
		projectId: z.string().min(1),
		draftId: z.uuid(),
		contractVersion: z.string(),
		createdAt: z.iso.datetime(),
		base: offlineConflictBaseSchema,
		cloud: offlineConflictCloudSchema,
		local: offlineConflictLocalSchema,
		localDigest: z.string().min(1),
		resolution: offlineConflictResolutionSchema.nullable(),
	})
	.strict();

export const offlineReconcileResponseSchema = z.discriminatedUnion("outcome", [
	z
		.object({
			outcome: z.literal("base-current"),
			draft: z
				.object({
					id: z.uuid(),
					revision: revisionSchema,
					sourceAssetVersionId: z.uuid(),
				})
				.strict(),
		})
		.strict(),
	z
		.object({
			outcome: z.literal("conflict"),
			conflict: offlineConflictViewSchema,
		})
		.strict(),
]);

export const offlineConflictResolveResponseSchema = z
	.object({ conflict: offlineConflictViewSchema, created: z.boolean() })
	.strict();

export const offlineConflictListSchema = z
	.object({
		conflicts: z.array(offlineConflictViewSchema),
		/** Records this reader cannot resolve; their content is preserved. */
		unreadable: z.array(
			z
				.object({
					id: z.uuid(),
					contractVersion: z.string(),
					message: z.string(),
				})
				.strict()
		),
	})
	.strict();

export const offlineConflictSides = ["base", "cloud", "local"] as const;

export type OfflineConflictChoice = z.infer<typeof offlineConflictChoiceSchema>;
export type OfflineConflictView = z.infer<typeof offlineConflictViewSchema>;
export type OfflineAbandonConfirmation = z.infer<
	typeof offlineAbandonConfirmationSchema
>;
export type OfflineConflictResolveInput = z.infer<
	typeof offlineConflictResolveInputSchema
>;
export type OfflineConflictResolveResponse = z.infer<
	typeof offlineConflictResolveResponseSchema
>;
export type OfflineReconcileInput = z.infer<typeof offlineReconcileInputSchema>;
export type OfflineReconcileResponse = z.infer<
	typeof offlineReconcileResponseSchema
>;
export type OfflineConflictList = z.infer<typeof offlineConflictListSchema>;

/** Persisted immutable Offline Conflict Record row. `content` is the raw stored JSON. */
export interface OfflineConflictRecordRow {
	baseRevision: number;
	cloudRevision: number;
	content: unknown;
	contractVersion: string;
	createdAt: Date;
	draftId: string;
	id: string;
	localDigest: string;
	ownerUserId: string;
	projectId: string;
}

export interface OfflineConflictResolutionRow {
	choice: OfflineConflictChoice;
	conflictId: string;
	id: string;
	idempotencyKey: string;
	resolvedAt: Date;
	resolvedByUserId: string;
	resultAssetVersionId: string | null;
}

export interface OfflineConflictEntry {
	record: OfflineConflictRecordRow;
	resolution: OfflineConflictResolutionRow | null;
}

export interface OfflineConflictCreateInput {
	baseRevision: number;
	cloudRevision: number;
	content: unknown;
	contractVersion: string;
	draftId: string;
	id: string;
	localDigest: string;
	projectId: string;
}

export interface OfflineConflictResolutionInput {
	choice: OfflineConflictChoice;
	conflictId: string;
	id: string;
	idempotencyKey: string;
	projectId: string;
	resultAssetVersionId: string | null;
}

/**
 * Records are never updated or deleted; resolving adds one resolution row
 * beside them. A create-candidate resolution is claimed first without a result
 * so a losing request never creates a Candidate Version; the claim is then
 * completed with the Candidate Version, or released if that write failed.
 */
export interface OfflineConflictStore {
	completeResolution: (
		userId: string,
		conflictId: string,
		resultAssetVersionId: string
	) => Promise<OfflineConflictResolutionRow | null>;
	createRecord: (
		userId: string,
		input: OfflineConflictCreateInput
	) => Promise<{ entry: OfflineConflictEntry; kind: "created" | "existing" }>;
	createResolution: (
		userId: string,
		input: OfflineConflictResolutionInput
	) => Promise<{
		kind: "created" | "existing";
		resolution: OfflineConflictResolutionRow;
	} | null>;
	getEntry: (
		userId: string,
		projectId: string,
		conflictId: string
	) => Promise<OfflineConflictEntry | null>;
	listEntries: (
		userId: string,
		projectId: string
	) => Promise<OfflineConflictEntry[]>;
	/** Removes only a claim that has no result yet and carries this key. */
	releaseResolution: (
		userId: string,
		conflictId: string,
		idempotencyKey: string
	) => Promise<void>;
}
