import type {
	DeliveryTargetActivateInput,
	DeliveryTargetDraftSaveInput,
} from "./delivery-planning-inputs";
import type {
	DeliveryTargetCatalog,
	DeliveryTargetDraft,
	DeliveryTargetRevision,
} from "./delivery-planning-outputs";

export type DeliveryTargetDraftSaveFailureReason =
	| "context_revision_not_found"
	| "delivery_target_unavailable"
	| "draft_id_conflict"
	| "policy_family_not_pinned"
	| "required_set_revision_not_found";

export type DeliveryTargetDraftSaveResult =
	| { draft: DeliveryTargetDraft; status: "saved" }
	| { reason: DeliveryTargetDraftSaveFailureReason; status: "rejected" };

export type DeliveryTargetActivateResult =
	| { revision: DeliveryTargetRevision; status: "activated" }
	| { status: "revision_number_conflict" };

/** Authorized, project-scoped access to Delivery Target drafts and revisions. */
export interface DeliveryTargetStore {
	/** Turns a draft into the next immutable revision; null when the project or draft is not found, a conflict when the revision number stays contested. */
	activate: (
		userId: string,
		input: DeliveryTargetActivateInput
	) => Promise<DeliveryTargetActivateResult | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<DeliveryTargetCatalog | null>;
	/** Records a draft only; it changes no revision, readiness or Required Items List. Null when the project is not found. */
	saveDraft: (
		userId: string,
		input: DeliveryTargetDraftSaveInput
	) => Promise<DeliveryTargetDraftSaveResult | null>;
}
