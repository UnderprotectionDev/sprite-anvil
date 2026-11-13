import type {
	DeletionReceipt,
	ErasureConfirmedCounts,
} from "@sprite-anvil/api/permanent-erasure-deletion";

export interface StoredErasureAuthorization {
	authorizedByUserId: string;
	confirmed: ErasureConfirmedCounts;
	createdAt: Date;
	id: string;
	idempotencyKey: string;
	projectId: string;
	reportDigest: string;
	reportId: string;
	/** Digest of the authorize request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	selectedContainerIds: string[];
}

export interface StoredDeletionReceipt {
	/** Same as the authorization id: one authorization can only ever have one receipt. */
	id: string;
	projectId: string;
	receipt: DeletionReceipt;
	receiptDigest: string;
}

/** What stays of an erased Asset Version: identity and the receipt that erased it, never content. */
export interface ErasureTombstoneRow {
	assetRecordId: string;
	assetVersionId: string;
	erasedAt: Date;
	projectId: string;
	receiptId: string;
}

export interface FinalizeErasureInput {
	assetRecordId: string;
	projectId: string;
	receipt: StoredDeletionReceipt;
	/** Whole containers removed together with the receipt; none is ever rewritten. */
	removeContainers: { id: string; kind: "export_bundle" | "project_archive" }[];
	tombstones: ErasureTombstoneRow[];
}

/** The persistent side of the Deletion Job. Authorizations and receipts are only ever inserted. */
export interface ErasureDeletionStorage {
	/**
	 * Storage locations of the included files of the given Project Archives that
	 * hold content of the given Asset Versions. An archive's other files point at
	 * objects the project still uses, so those are never returned.
	 */
	archiveObjectKeys: (
		projectId: string,
		archiveIds: string[],
		assetVersionIds: string[]
	) => Promise<string[]>;
	/**
	 * One atomic write: the receipt, the Erasure Tombstones, the erased
	 * availability of the Asset Record and the removal of the selected whole
	 * containers. `existing` means a receipt for this authorization is already
	 * there and nothing was written.
	 */
	finalize: (
		input: FinalizeErasureInput
	) => Promise<{ status: "existing" } | { status: "finalized" }>;
	findAuthorization: (
		projectId: string,
		id: string
	) => Promise<StoredErasureAuthorization | null>;
	findReceipt: (
		projectId: string,
		id: string
	) => Promise<StoredDeletionReceipt | null>;
	insertAuthorization: (
		row: StoredErasureAuthorization
	) => Promise<
		| { status: "inserted" }
		| { existing: StoredErasureAuthorization; status: "existing" }
	>;
	/** Storage locations of the given Asset Versions; never leaves the server. */
	objectKeys: (
		projectId: string,
		assetVersionIds: string[]
	) => Promise<Map<string, string>>;
}

/**
 * Removes one stored object. Removing a missing object succeeds, so a repeat
 * changes nothing: a retry after a partial removal may remove the same key again.
 */
export interface ErasureObjectRemover {
	delete: (key: string) => Promise<void>;
}
