import type { ErasureContainerRef } from "@sprite-anvil/api/permanent-erasure";
import type {
	DeletionReceipt,
	ErasureConfirmedCounts,
} from "@sprite-anvil/api/permanent-erasure-deletion";

export interface StoredErasureApproval {
	approvedByUserId: string;
	confirmed: ErasureConfirmedCounts;
	createdAt: Date;
	id: string;
	idempotencyKey: string;
	projectId: string;
	reportDigest: string;
	reportId: string;
	/** Digest of the approval request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	selectedContainerIds: string[];
}

export interface StoredDeletionReceipt {
	/** Same as the approval id: one approval can only ever have one receipt. */
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
	/**
	 * The scope the removal was proven against. Finalizing re-checks the live
	 * rows against it inside the write, so a version or container that appeared
	 * after the proof never gets a receipt that does not mention it.
	 */
	expected: {
		assetVersionIds: string[];
		/** Every whole container embedding the asset's content, selected or not. */
		containers: ErasureContainerRef[];
	};
	projectId: string;
	receipt: StoredDeletionReceipt;
	/** Whole containers removed together with the receipt; none is ever rewritten. */
	removeContainers: ErasureContainerRef[];
	tombstones: ErasureTombstoneRow[];
}

/** The scope no longer matches what was proven, or the Asset Record can no longer be erased; nothing was written. */
export class ErasureScopeChangedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ErasureScopeChangedError";
	}
}

/** The persistent side of the Deletion Job. Approvals, removal starts and receipts are only ever inserted. */
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
	 * availability of the Asset Record, the redacted file names of its versions
	 * and the removal of the selected whole containers. `existing` means a
	 * receipt for this approval is already there and nothing was written.
	 * Throws `ErasureScopeChangedError` when the live rows no longer match
	 * `expected`; then nothing was written either.
	 */
	finalize: (
		input: FinalizeErasureInput
	) => Promise<{ status: "existing" } | { status: "finalized" }>;
	findApproval: (
		projectId: string,
		id: string
	) => Promise<StoredErasureApproval | null>;
	findReceipt: (
		projectId: string,
		id: string
	) => Promise<StoredDeletionReceipt | null>;
	insertApproval: (
		row: StoredErasureApproval
	) => Promise<
		| { status: "inserted" }
		| { existing: StoredErasureApproval; status: "existing" }
	>;
	/** Records that the removal of stored objects began, once. Recording it again changes nothing. */
	markRemovalStarted: (row: {
		approvalId: string;
		projectId: string;
		startedAt: Date;
	}) => Promise<void>;
	/** Storage locations of the given Asset Versions; never leaves the server. */
	objectKeys: (
		projectId: string,
		assetVersionIds: string[]
	) => Promise<Map<string, string>>;
	/** Whether an earlier attempt already began removing objects for this approval. */
	removalStarted: (projectId: string, approvalId: string) => Promise<boolean>;
}

/**
 * Removes one stored object. Removing a missing object succeeds, so a repeat
 * changes nothing: a retry after a partial removal may remove the same key again.
 */
export interface ErasureObjectRemover {
	delete: (key: string) => Promise<void>;
}
