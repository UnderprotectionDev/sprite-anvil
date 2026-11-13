import type { BackgroundOperation } from "./background-operations";
import type {
	DeletionReceiptRecord,
	ErasureApprovalInput,
	ErasureApprovalResult,
} from "./permanent-erasure-deletion";

/** Authorized, project-scoped access to content-free Deletion Receipts. */
export interface DeletionReceiptStore {
	/** Null when the project or receipt is not found. */
	get: (
		userId: string,
		projectId: string,
		receiptId: string
	) => Promise<DeletionReceiptRecord | null>;
}

/** Records the user's approval of an exact Erasure Impact Report and the Deletion Job it starts. */
export interface ErasureApprovalOperations {
	/**
	 * Idempotent: the same key and content returns the first Deletion Job, even
	 * after it finished. Null when the project is not found.
	 */
	approve: (
		userId: string,
		input: ErasureApprovalInput
	) => Promise<ErasureApprovalResult<BackgroundOperation> | null>;
}
