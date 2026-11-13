import type {
	ErasureDeletionStorage,
	ErasureTombstoneRow,
	StoredDeletionReceipt,
	StoredErasureApproval,
} from "../erasure-deletion-storage";

/** An in-memory ErasureDeletionStorage; finalize is one atomic step, as in the database. */
export function createMemoryErasureDeletionStorage(
	objectKeys: Record<string, string>,
	/** Keys of included archive files that belong to erased versions, per archive id. */
	archiveObjectKeys: Record<string, string[]> = {}
) {
	const approvals = new Map<string, StoredErasureApproval>();
	const receipts = new Map<string, StoredDeletionReceipt>();
	const tombstones: ErasureTombstoneRow[] = [];
	const removedContainers: string[] = [];
	const erasedAssetRecords: string[] = [];
	const storage: ErasureDeletionStorage = {
		findApproval: (projectId, id) => {
			const found = approvals.get(id);
			return Promise.resolve(found?.projectId === projectId ? found : null);
		},
		findReceipt: (projectId, id) => {
			const found = receipts.get(id);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		finalize: (input) => {
			if (receipts.has(input.receipt.id)) {
				return Promise.resolve({ status: "existing" });
			}
			receipts.set(input.receipt.id, structuredClone(input.receipt));
			tombstones.push(...input.tombstones);
			removedContainers.push(...input.removeContainers.map((c) => c.id));
			erasedAssetRecords.push(input.assetRecordId);
			return Promise.resolve({ status: "finalized" });
		},
		insertApproval: (row) => {
			const existing = approvals.get(row.id);
			if (existing) {
				return Promise.resolve({ existing, status: "existing" });
			}
			approvals.set(row.id, structuredClone(row));
			return Promise.resolve({ status: "inserted" });
		},
		archiveObjectKeys: (_projectId, archiveIds) =>
			Promise.resolve(archiveIds.flatMap((id) => archiveObjectKeys[id] ?? [])),
		objectKeys: (_projectId, ids) => {
			const found = new Map<string, string>();
			for (const id of ids) {
				const key = objectKeys[id];
				if (key) {
					found.set(id, key);
				}
			}
			return Promise.resolve(found);
		},
	};
	return {
		approvals,
		erasedAssetRecords,
		receipts,
		removedContainers,
		storage,
		tombstones,
	};
}
