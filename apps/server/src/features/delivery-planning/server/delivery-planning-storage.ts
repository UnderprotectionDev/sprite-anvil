import type { DeliveryTargetPurpose } from "@sprite-anvil/api/delivery-planning";

export interface PinnedFamily {
	assetFamilyId: string;
	requiredSetRevisionId: string;
}

export interface StoredDeliveryTarget {
	id: string;
	name: string;
	projectId: string;
	purpose: DeliveryTargetPurpose;
}

export interface StoredDeliveryTargetDraft {
	contextRevisionId: string;
	createdAt: Date;
	createdByUserId: string;
	deliveryTargetId: string;
	families: PinnedFamily[];
	id: string;
	projectId: string;
}

export interface StoredDeliveryTargetRevision {
	activatedAt: Date;
	activatedByUserId: string;
	contextRevisionId: string;
	deliveryTargetId: string;
	draftId: string;
	families: PinnedFamily[];
	id: string;
	projectId: string;
	revisionNumber: number;
}

export interface ContextRevisionSnapshot {
	id: string;
	revisionNumber: number;
}

export interface RequiredSetRevisionSnapshot {
	assetFamilyId: string;
	assetFamilyName: string;
	id: string;
	items: unknown[];
	revisionNumber: number;
}

export type NewDeliveryTargetRevision = Omit<
	StoredDeliveryTargetRevision,
	"revisionNumber"
>;

export type InsertRevisionResult =
	| { revision: StoredDeliveryTargetRevision; status: "inserted" }
	| { status: "conflict" };

/**
 * The persistent side of Delivery Target planning. It only reads the Context
 * Revisions and Required Items List revisions it pins; it never writes them.
 */
export interface DeliveryPlanningStorage {
	findContextRevisions: (
		projectId: string,
		ids: string[]
	) => Promise<ContextRevisionSnapshot[]>;
	findDraft: (
		projectId: string,
		draftId: string
	) => Promise<StoredDeliveryTargetDraft | null>;
	findRequiredSetRevisions: (
		projectId: string,
		ids: string[]
	) => Promise<RequiredSetRevisionSnapshot[]>;
	findRevisionForDraft: (
		projectId: string,
		draftId: string
	) => Promise<StoredDeliveryTargetRevision | null>;
	findTarget: (
		projectId: string,
		deliveryTargetId: string
	) => Promise<StoredDeliveryTarget | null>;
	/** Records the target when it is new, and the draft, together; false when the draft id already exists. */
	insertDraft: (
		target: StoredDeliveryTarget,
		draft: StoredDeliveryTargetDraft
	) => Promise<boolean>;
	/** Inserts the target's next revision number; a conflict means the draft or the number was taken concurrently. */
	insertRevision: (
		revision: NewDeliveryTargetRevision
	) => Promise<InsertRevisionResult>;
	listDrafts: (projectId: string) => Promise<StoredDeliveryTargetDraft[]>;
	listRevisions: (projectId: string) => Promise<StoredDeliveryTargetRevision[]>;
	listTargets: (projectId: string) => Promise<StoredDeliveryTarget[]>;
}
