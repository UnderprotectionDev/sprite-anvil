import type {
	DeliveryTargetPurpose,
	ProductionEvidencePolicy,
	RightsEvidencePolicy,
} from "@sprite-anvil/api/delivery-planning-inputs";

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

/** What a draft pins and a revision inherits; a new pinned field is added here and nowhere else. */
export interface PinnedScope {
	contextRevisionId: string;
	families: PinnedFamily[];
	productionEvidencePolicy: ProductionEvidencePolicy;
	rightsEvidencePolicy: RightsEvidencePolicy;
}

export interface StoredDeliveryTargetDraft extends PinnedScope {
	createdAt: Date;
	createdByUserId: string;
	deliveryTargetId: string;
	id: string;
	projectId: string;
}

export interface StoredDeliveryTargetRevision extends PinnedScope {
	activatedAt: Date;
	activatedByUserId: string;
	deliveryTargetId: string;
	draftId: string;
	id: string;
	projectId: string;
	revisionNumber: number;
}

/** Copies exactly the pinned fields, so no caller lists them by hand. */
export function pinnedScopeOf(source: PinnedScope): PinnedScope {
	return {
		contextRevisionId: source.contextRevisionId,
		families: source.families,
		productionEvidencePolicy: source.productionEvidencePolicy,
		rightsEvidencePolicy: source.rightsEvidencePolicy,
	};
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
