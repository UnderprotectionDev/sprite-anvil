import type {
	DeliveryTargetPurpose,
	ProductionEvidencePolicy,
	RightsEvidencePolicy,
} from "@sprite-anvil/api/delivery-planning";

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
	productionEvidencePolicy: ProductionEvidencePolicy;
	projectId: string;
	rightsEvidencePolicy: RightsEvidencePolicy;
}

export interface StoredDeliveryTargetRevision {
	activatedAt: Date;
	activatedByUserId: string;
	contextRevisionId: string;
	deliveryTargetId: string;
	draftId: string;
	families: PinnedFamily[];
	id: string;
	productionEvidencePolicy: ProductionEvidencePolicy;
	projectId: string;
	revisionNumber: number;
	rightsEvidencePolicy: RightsEvidencePolicy;
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

export type InsertDraftResult =
	| "draft_exists"
	| "inserted"
	| "target_in_other_project";

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
	/** Records the target when it is new, and the draft, together; reports an existing draft id or a target id owned by another project instead of throwing. */
	insertDraft: (
		target: StoredDeliveryTarget,
		draft: StoredDeliveryTargetDraft
	) => Promise<InsertDraftResult>;
	/** Inserts the target's next revision number; a conflict means the draft or the number was taken concurrently. */
	insertRevision: (
		revision: NewDeliveryTargetRevision
	) => Promise<InsertRevisionResult>;
	listDrafts: (projectId: string) => Promise<StoredDeliveryTargetDraft[]>;
	listRevisions: (projectId: string) => Promise<StoredDeliveryTargetRevision[]>;
	listTargets: (projectId: string) => Promise<StoredDeliveryTarget[]>;
}
