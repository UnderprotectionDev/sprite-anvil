import type { FulfilmentRequirementRecord } from "@sprite-anvil/api/delivery-fulfilment-records";

/** A Delivery Fulfilment as persisted: header plus its requirement rows in order. */
export interface StoredDeliveryFulfilment {
	createdAt: Date;
	createdByUserId: string;
	deliveryTargetId: string;
	draftId: string;
	id: string;
	projectId: string;
	requestDigest: string;
	requirements: FulfilmentRequirementRecord[];
	revisionId: string;
	revisionNumber: number;
}

export type InsertDeliveryFulfilmentResult =
	| { status: "inserted" }
	/** The id already exists. */
	| { status: "conflict" };

/** The persistent side of Delivery Fulfilments. Rows are only ever inserted, header and requirements together; there is no update or delete. */
export interface DeliveryFulfilmentStorage {
	/** The given Asset Versions that an Erasure Tombstone stands for; no Fulfilment row is read or changed. */
	erasedAssetVersionIds: (
		projectId: string,
		assetVersionIds: string[]
	) => Promise<Set<string>>;
	findFulfilment: (
		projectId: string,
		fulfilmentId: string
	) => Promise<StoredDeliveryFulfilment | null>;
	/** True when any Fulfilment exists for the revision. */
	hasFulfilment: (projectId: string, revisionId: string) => Promise<boolean>;
	insertFulfilment: (
		fulfilment: StoredDeliveryFulfilment
	) => Promise<InsertDeliveryFulfilmentResult>;
	listFulfilments: (
		projectId: string,
		deliveryTargetId: string
	) => Promise<StoredDeliveryFulfilment[]>;
}
