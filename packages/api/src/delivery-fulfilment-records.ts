import { z } from "zod";
import type { DeliveryDiff, DeliveryDiffInput } from "./delivery-diff";
import {
	deliveryTargetScopeInputSchema,
	fulfilmentRequirementIdentityShape,
	idSchema,
} from "./delivery-fulfilment-shared";
import { idempotencyKeySchema } from "./record-publication";

/** The user's pick of one bundle for one conflicting requirement. */
export const fulfilmentSelectionSchema = z
	.object({
		assetFamilyId: z.string().min(1),
		bundleId: z.string().min(1),
		itemId: z.string().min(1),
	})
	.strict();
export type FulfilmentSelection = z.infer<typeof fulfilmentSelectionSchema>;

/**
 * Finalizes one mapping draft into an immutable Delivery Fulfilment. The user
 * supplies a selection for every conflicting requirement; the same
 * `idempotencyKey` with the same content replays the first Fulfilment.
 */
export const fulfilmentFinalizeInputSchema = z
	.object({
		deliveryTargetId: idSchema,
		draftId: idSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		selections: z.array(fulfilmentSelectionSchema).max(1000),
	})
	.strict();
export type FulfilmentFinalizeInput = z.infer<
	typeof fulfilmentFinalizeInputSchema
>;

export const deliveryFulfilmentGetInputSchema = z
	.object({ fulfilmentId: idSchema, projectId: idSchema })
	.strict();

export const deliveryFulfilmentListInputSchema = deliveryTargetScopeInputSchema;

/**
 * only_bundle: exactly one bundle met the requirement.
 * identical_pins: several bundles pinned the same Asset Versions; the earliest bundle is recorded.
 * user_selected: several bundles pinned different Asset Versions and the user picked.
 */
export const fulfilmentResolutionSchema = z.enum([
	"only_bundle",
	"identical_pins",
	"user_selected",
]);
export type FulfilmentResolution = z.infer<typeof fulfilmentResolutionSchema>;

/** One requirement of the revision mapped to the exact bundle and Asset Versions that fulfilled it. */
export const fulfilmentRequirementRecordSchema = z
	.object({
		...fulfilmentRequirementIdentityShape,
		assetVersionIds: z.array(z.string()).min(1),
		bundleId: z.string(),
		manifestDigest: z.string(),
		resolution: fulfilmentResolutionSchema,
	})
	.strict();
export type FulfilmentRequirementRecord = z.infer<
	typeof fulfilmentRequirementRecordSchema
>;

export const deliveryFulfilmentSchema = z
	.object({
		createdAt: z.iso.datetime(),
		deliveryTargetId: idSchema,
		draftId: idSchema,
		id: idSchema,
		/** Computed on read: the newest Fulfilment of its revision. The stored rows never change. */
		isCurrent: z.boolean(),
		projectId: idSchema,
		requirements: z.array(fulfilmentRequirementRecordSchema),
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
	})
	.strict();
export type DeliveryFulfilment = z.infer<typeof deliveryFulfilmentSchema>;

export const deliveryFulfilmentListSchema = z
	.object({ fulfilments: z.array(deliveryFulfilmentSchema) })
	.strict();
export type DeliveryFulfilmentList = z.infer<
	typeof deliveryFulfilmentListSchema
>;

export type FulfilmentFinalizeRejection =
	| "invalid_selection"
	| "missing_requirements"
	| "no_active_revision"
	| "no_requirements"
	| "revision_changed"
	| "target_not_ready"
	| "unresolved_conflicts";

export type FulfilmentFinalizeResult =
	| { fulfilment: DeliveryFulfilment; status: "created" | "replayed" }
	| { reason: FulfilmentFinalizeRejection; status: "rejected" };

/** Authorized, project-scoped Delivery Fulfilments. Rows are only created, never changed. */
export interface DeliveryFulfilmentStore {
	/** Read-only Delivery Diff of two Fulfilments. Null when the project or either Fulfilment is not found. */
	compare: (
		userId: string,
		input: DeliveryDiffInput
	) => Promise<DeliveryDiff | null>;
	/** Finalizes a draft. Null when the project, Delivery Target or draft is not found. */
	finalize: (
		userId: string,
		input: FulfilmentFinalizeInput
	) => Promise<FulfilmentFinalizeResult | null>;
	/** Null when the project or Fulfilment is not found. */
	get: (
		userId: string,
		input: { fulfilmentId: string; projectId: string }
	) => Promise<DeliveryFulfilment | null>;
	/** Newest first. Null when the project or Delivery Target is not found. */
	list: (
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) => Promise<DeliveryFulfilmentList | null>;
}

/** Whether a Fulfilment exists for a revision; the Readiness Plan's Delivery Status reads only this. */
export interface DeliveredRevisionLookup {
	hasFulfilment: (projectId: string, revisionId: string) => Promise<boolean>;
}
