import { z } from "zod";

const idSchema = z.uuid();
const workIdSchema = z.string().trim().min(1).max(400);

export const readinessPlanGetInputSchema = z
	.object({ deliveryTargetId: idSchema, projectId: idSchema })
	.strict();
export type ReadinessPlanGetInput = z.infer<typeof readinessPlanGetInputSchema>;

export const readinessPlanReorderInputSchema = z
	.object({
		deliveryTargetId: idSchema,
		/** Complete order the user chose for the plan's dependent work; first is worked first. */
		orderedWorkIds: z
			.array(workIdSchema)
			.max(1000)
			.refine(
				(ids) => new Set(ids).size === ids.length,
				"A work item can be ordered only once."
			),
		projectId: idSchema,
		/** The Delivery Target revision of the plan the user was looking at. */
		revisionId: idSchema,
	})
	.strict();
export type ReadinessPlanReorderInput = z.infer<
	typeof readinessPlanReorderInputSchema
>;

export const targetReadinessSchema = z.enum(["ready", "blocked"]);

export const deliveryStatusSchema = z.enum(["not_delivered", "delivered"]);

export const readinessBlockerKindSchema = z.enum([
	"required_item_incomplete",
	"pinned_required_list_not_active",
	"family_readiness_unavailable",
	"production_evidence_policy_not_evaluated",
	"rights_evidence_policy_not_evaluated",
]);
export type ReadinessBlockerKind = z.infer<typeof readinessBlockerKindSchema>;

/** One acceptance condition the target does not meet, and the exact evidence still missing for it. */
export const readinessBlockerSchema = z
	.object({
		assetFamilyId: z.string().nullable(),
		assetFamilyName: z.string().nullable(),
		/** Readiness blocker codes of the item (for example `approval`, `quality`). */
		blockerCodes: z.array(z.string()),
		id: z.string(),
		itemId: z.string().nullable(),
		itemName: z.string().nullable(),
		kind: readinessBlockerKindSchema,
		unmetRequirements: z.array(
			z
				.object({
					id: z.string(),
					isCurrent: z.boolean(),
					kind: z.enum(["quality", "human_review", "usage_test"]),
					name: z.string(),
					result: z.string(),
				})
				.strict()
		),
	})
	.strict();
export type ReadinessBlocker = z.infer<typeof readinessBlockerSchema>;

export const readinessWorkItemSchema = z
	.object({
		blockerId: z.string(),
		/** Work this one has to wait for, within the item or across items that share an Asset Record. */
		dependsOnWorkIds: z.array(z.string()),
		id: workIdSchema,
		/** Work that becomes startable once this one is done. */
		opensWorkIds: z.array(z.string()),
		/** Where this item sits in the plan: the user's order, or the system suggestion when the user has not ordered it. */
		orderSource: z.enum(["user", "suggested"]),
		position: z.number().int().positive(),
		/** Four separate rationales; they are never combined into one score. */
		rationales: z
			.object({
				revalidationImpact: z
					.object({
						/** Derivative versions linked to this item's current versions that a change would put at risk. */
						derivativeVersionIds: z.array(z.string()),
						/** Versions of this item already waiting for revalidation. */
						requiredNowVersionIds: z.array(z.string()),
					})
					.strict(),
				targetRequirement: z
					.object({
						itemId: z.string().nullable(),
						requiredSetRevisionId: z.string().nullable(),
						requiredSetRevisionNumber: z.number().int().positive().nullable(),
						source: z.enum([
							"required_items_list",
							"production_evidence_policy",
							"rights_evidence_policy",
						]),
					})
					.strict(),
				unlocksDependentWork: z
					.object({ count: z.number().int().nonnegative() })
					.strict(),
				userPriority: z
					.object({ position: z.number().int().positive().nullable() })
					.strict(),
			})
			.strict(),
		title: z.string(),
	})
	.strict();
export type ReadinessWorkItem = z.infer<typeof readinessWorkItemSchema>;

export const readinessPlanSchema = z
	.object({
		blockers: z.array(readinessBlockerSchema),
		/** Delivered only when a Delivery Fulfilment exists for this revision; a Readiness Plan never creates one, so a Ready target alone stays not delivered. A newer revision starts not delivered. */
		deliveryStatus: deliveryStatusSchema,
		deliveryTargetId: idSchema,
		/** Work that sits before something it depends on, because the user ordered it so. Informational; the user's order stands. */
		orderWarnings: z.array(
			z.object({ prerequisiteWorkId: z.string(), workId: z.string() }).strict()
		),
		/** A suggestion only: the first startable item. Nothing is started by the plan. */
		recommendedNext: z
			.object({
				basis: z.enum(["user_order", "suggested_order"]),
				workId: z.string(),
			})
			.strict()
			.nullable(),
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
		targetReadiness: targetReadinessSchema,
		workItems: z.array(readinessWorkItemSchema),
	})
	.strict();
export type ReadinessPlan = z.infer<typeof readinessPlanSchema>;

export type ReadinessPlanGetResult =
	| { plan: ReadinessPlan; status: "found" }
	| { status: "no_active_revision" };

export type ReadinessPlanReorderFailureReason =
	| "revision_not_active"
	| "work_missing_from_order"
	| "work_not_in_plan";

export type ReadinessPlanReorderResult =
	| { plan: ReadinessPlan; status: "saved" }
	| { reason: ReadinessPlanReorderFailureReason; status: "rejected" }
	| { status: "no_active_revision" };

/** Authorized, project-scoped Readiness Plans computed from the active Delivery Target revision. */
export interface ReadinessPlanStore {
	/** Null when the project or Delivery Target is not found. */
	get: (
		userId: string,
		input: ReadinessPlanGetInput
	) => Promise<ReadinessPlanGetResult | null>;
	/** Saves only the user's ordering; it starts nothing and changes no readiness. Null when the project or Delivery Target is not found. */
	reorder: (
		userId: string,
		input: ReadinessPlanReorderInput
	) => Promise<ReadinessPlanReorderResult | null>;
}
