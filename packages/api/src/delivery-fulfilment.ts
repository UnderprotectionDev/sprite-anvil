import { z } from "zod";
import { requiredSetItemKindSchema } from "./family-readiness";
import { idempotencyKeySchema } from "./record-publication";
import { runtimeValidationReadinessSchema } from "./runtime-validation-readiness";

const idSchema = z.uuid();

/**
 * Prepares one mapping draft for the active revision of a Delivery Target.
 * Preparing is a system proposal; it creates no Delivery Fulfilment. The same
 * `idempotencyKey` replays the first draft.
 */
export const fulfilmentMappingPrepareInputSchema = z
	.object({
		deliveryTargetId: idSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
	})
	.strict();
export type FulfilmentMappingPrepareInput = z.infer<
	typeof fulfilmentMappingPrepareInputSchema
>;

export const fulfilmentMappingGetInputSchema = z
	.object({ draftId: idSchema, projectId: idSchema })
	.strict();

export const fulfilmentMappingListInputSchema = z
	.object({ deliveryTargetId: idSchema, projectId: idSchema })
	.strict();

/**
 * mapped: exactly one candidate bundle meets the requirement.
 * agreed: several bundles meet it and pin the same Asset Versions.
 * conflict: several bundles meet it with different Asset Versions; only the user picks.
 * missing: no candidate bundle meets it.
 */
export const fulfilmentRequirementStatusSchema = z.enum([
	"mapped",
	"agreed",
	"conflict",
	"missing",
]);
export type FulfilmentRequirementStatus = z.infer<
	typeof fulfilmentRequirementStatusSchema
>;

/** One bundle that meets a requirement, with the exact Asset Versions it pins for it. */
export const fulfilmentCandidateSchema = z
	.object({
		assetVersionIds: z.array(z.string()).min(1),
		bundleId: z.string(),
		manifestDigest: z.string(),
	})
	.strict();
export type FulfilmentCandidate = z.infer<typeof fulfilmentCandidateSchema>;

/** One required Required Set item (usage tests included) of one pinned family. */
export const fulfilmentRequirementSchema = z
	.object({
		assetFamilyId: z.string(),
		assetFamilyName: z.string(),
		candidates: z.array(fulfilmentCandidateSchema),
		itemId: z.string(),
		itemKind: requiredSetItemKindSchema,
		itemName: z.string(),
		/** Set for mapped and agreed requirements only; a conflict or a missing requirement has no proposal. */
		proposedBundleId: z.string().nullable(),
		requiredSetRevisionId: z.string(),
		status: fulfilmentRequirementStatusSchema,
	})
	.strict();
export type FulfilmentRequirement = z.infer<typeof fulfilmentRequirementSchema>;

/** Per-bundle runtime validation evidence against the revision's criterion; separate from the requirement rows. */
export const fulfilmentBundleCheckSchema = z
	.object({
		bundleId: z.string(),
		createdAt: z.iso.datetime(),
		manifestDigest: z.string(),
		runtimeValidation: runtimeValidationReadinessSchema,
	})
	.strict();
export type FulfilmentBundleCheck = z.infer<typeof fulfilmentBundleCheckSchema>;

export const fulfilmentMappingDraftSchema = z
	.object({
		bundleChecks: z.array(fulfilmentBundleCheckSchema),
		createdAt: z.iso.datetime(),
		deliveryTargetId: idSchema,
		id: idSchema,
		projectId: idSchema,
		requirements: z.array(fulfilmentRequirementSchema),
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
	})
	.strict();
export type FulfilmentMappingDraft = z.infer<
	typeof fulfilmentMappingDraftSchema
>;

export const fulfilmentMappingDraftListSchema = z
	.object({ drafts: z.array(fulfilmentMappingDraftSchema) })
	.strict();
export type FulfilmentMappingDraftList = z.infer<
	typeof fulfilmentMappingDraftListSchema
>;

export function summarizeMappingDraft(draft: {
	requirements: { status: FulfilmentRequirementStatus }[];
}) {
	const count = (status: FulfilmentRequirementStatus) =>
		draft.requirements.filter((entry) => entry.status === status).length;
	return {
		conflict: count("conflict"),
		missing: count("missing"),
		resolved: count("mapped") + count("agreed"),
		total: draft.requirements.length,
	};
}

export type FulfilmentMappingPrepareResult =
	| { draft: FulfilmentMappingDraft; status: "created" | "replayed" }
	| {
			reason: "no_active_revision" | "target_not_ready";
			status: "rejected";
	  };

/** Authorized, project-scoped mapping drafts for Delivery Fulfilment. A draft never is a Fulfilment. */
export interface FulfilmentMappingStore {
	/** Null when the project or draft is not found. */
	get: (
		userId: string,
		input: { draftId: string; projectId: string }
	) => Promise<FulfilmentMappingDraft | null>;
	/** Newest first. Null when the project or Delivery Target is not found. */
	list: (
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) => Promise<FulfilmentMappingDraftList | null>;
	/** Null when the project or Delivery Target is not found. */
	prepare: (
		userId: string,
		input: FulfilmentMappingPrepareInput
	) => Promise<FulfilmentMappingPrepareResult | null>;
}
