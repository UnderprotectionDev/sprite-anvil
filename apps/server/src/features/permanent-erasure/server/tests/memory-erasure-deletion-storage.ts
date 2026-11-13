import type {
	ErasureDeletionStorage,
	ErasureTombstoneRow,
	StoredDeletionReceipt,
	StoredErasureAuthorization,
} from "../erasure-deletion-storage";

/** An in-memory ErasureDeletionStorage; finalize is one atomic step, as in the database. */
export function createMemoryErasureDeletionStorage(
	objectKeys: Record<string, string>,
	/** Keys of included archive files that belong to erased versions, per archive id. */
	archiveObjectKeys: Record<string, string[]> = {}
) {
	const authorizations = new Map<string, StoredErasureAuthorization>();
	const receipts = new Map<string, StoredDeletionReceipt>();
	const tombstones: ErasureTombstoneRow[] = [];
	const removedContainers: string[] = [];
	const erasedAssetRecords: string[] = [];
	const storage: ErasureDeletionStorage = {
		findAuthorization: (projectId, id) => {
			const found = authorizations.get(id);
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
		insertAuthorization: (row) => {
			const existing = authorizations.get(row.id);
			if (existing) {
				return Promise.resolve({ existing, status: "existing" });
			}
			authorizations.set(row.id, structuredClone(row));
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
		authorizations,
		erasedAssetRecords,
		receipts,
		removedContainers,
		storage,
		tombstones,
	};
}
