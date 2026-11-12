import type {
	FulfilmentBundleCheck,
	FulfilmentRequirement,
} from "@sprite-anvil/api/delivery-fulfilment";

/** A mapping draft as persisted: header plus its requirement rows in order. */
export interface StoredFulfilmentMappingDraft {
	bundleChecks: FulfilmentBundleCheck[];
	createdAt: Date;
	createdByUserId: string;
	deliveryTargetId: string;
	id: string;
	projectId: string;
	requestDigest: string;
	requirements: FulfilmentRequirement[];
	revisionId: string;
	revisionNumber: number;
}

export type InsertFulfilmentMappingDraftResult =
	| { status: "inserted" }
	/** The id already exists. */
	| { status: "conflict" };

/** The persistent side of mapping drafts. Rows are only ever inserted, header and requirements together. */
export interface FulfilmentMappingStorage {
	findDraft: (
		projectId: string,
		draftId: string
	) => Promise<StoredFulfilmentMappingDraft | null>;
	insertDraft: (
		draft: StoredFulfilmentMappingDraft
	) => Promise<InsertFulfilmentMappingDraftResult>;
	/** Newest first. */
	listDrafts: (
		projectId: string,
		deliveryTargetId: string
	) => Promise<StoredFulfilmentMappingDraft[]>;
}
