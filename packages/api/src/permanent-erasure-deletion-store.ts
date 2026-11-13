import type { DeletionReceiptRecord } from "./permanent-erasure-deletion";

/** Authorized, project-scoped access to content-free Deletion Receipts. */
export interface DeletionReceiptStore {
	/** Null when the project or receipt is not found. */
	get: (
		userId: string,
		projectId: string,
		receiptId: string
	) => Promise<DeletionReceiptRecord | null>;
}
