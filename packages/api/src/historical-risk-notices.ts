import { z } from "zod";
import {
	deliveryTargetScopeInputSchema,
	idSchema,
} from "./delivery-fulfilment-shared";
import { rightsEvidencePolicySchema } from "./delivery-planning-inputs";
import { rightsRecordStateSchema } from "./rights-records";

/** A requirement of the Delivery Fulfilment whose pinned Export Bundle carries the Asset Record the new Rights Record revision concerns. */
export const historicalRiskAffectedUsageSchema = z
	.object({
		assetFamilyId: z.string(),
		assetFamilyName: z.string(),
		bundleId: z.string(),
		itemId: z.string(),
		itemName: z.string(),
	})
	.strict();
export type HistoricalRiskAffectedUsage = z.infer<
	typeof historicalRiskAffectedUsageSchema
>;

/** The Rights Record revision the Delivery Fulfilment's bundle pinned for the Asset Record, if it pinned one. */
export const historicalRiskPinnedRightsSchema = z
	.object({
		rightsRecordId: idSchema,
		state: z.string(),
		versionNumber: z.number().int().positive(),
	})
	.strict();

/**
 * Whether the target's current active revision, read now, accepts the new
 * Rights Record state. It is derived on every read and never stored, so the
 * notice itself stays exactly as it was detected.
 */
export const historicalRiskCurrentPolicySchema = z
	.object({
		accepted: z.boolean(),
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
	})
	.strict();

export const historicalRiskNoticeSchema = z
	.object({
		affectedUsage: z.array(historicalRiskAffectedUsageSchema).min(1),
		/** The Asset Record whose new Rights Record revision is the risky source. */
		assetRecordId: idSchema,
		deliveryTargetId: idSchema,
		/** The time the product detected the mismatch. */
		detectedAt: z.iso.datetime(),
		fulfilmentId: idSchema,
		id: idSchema,
		/** The Rights Evidence Policy the Delivery Fulfilment's revision pinned; copied so the notice never depends on a later read. */
		pinnedPolicy: rightsEvidencePolicySchema,
		pinnedRights: historicalRiskPinnedRightsSchema.nullable(),
		projectId: idSchema,
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
		/** The new Rights Record revision that does not match the pinned policy. */
		rightsRecordId: idSchema,
		rightsRecordState: rightsRecordStateSchema,
		rightsRecordVersionNumber: z.number().int().positive(),
	})
	.strict();
export type HistoricalRiskNoticeRecord = z.infer<
	typeof historicalRiskNoticeSchema
>;

export const historicalRiskNoticeViewSchema = historicalRiskNoticeSchema
	.extend({ currentPolicy: historicalRiskCurrentPolicySchema.nullable() })
	.strict();
export type HistoricalRiskNotice = z.infer<
	typeof historicalRiskNoticeViewSchema
>;

export const historicalRiskNoticeListInputSchema =
	deliveryTargetScopeInputSchema;

export const historicalRiskNoticeListSchema = z
	.object({ notices: z.array(historicalRiskNoticeViewSchema) })
	.strict();
export type HistoricalRiskNoticeList = z.infer<
	typeof historicalRiskNoticeListSchema
>;

/** Authorized, project-scoped Historical Risk Notices. Notices are only created, never changed. */
export interface HistoricalRiskNoticeStore {
	/**
	 * Evaluates one new result-level Rights Record revision against every
	 * Delivery Fulfilment of the project and records a notice for each one whose
	 * pinned policy does not accept it. Repeating it adds nothing. Null when the
	 * project or the revision is not found.
	 */
	detect: (
		userId: string,
		input: { assetRecordId: string; projectId: string; rightsRecordId: string }
	) => Promise<{ notices: HistoricalRiskNotice[] } | null>;
	/** Newest first. Null when the project or Delivery Target is not found. */
	list: (
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) => Promise<HistoricalRiskNoticeList | null>;
}
