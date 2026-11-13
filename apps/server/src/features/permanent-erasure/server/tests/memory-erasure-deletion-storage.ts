import type { ErasureContainerRef } from "@sprite-anvil/api/permanent-erasure";
import {
	type ErasureDeletionStorage,
	ErasureScopeChangedError,
	type ErasureTombstoneRow,
	type StoredDeletionReceipt,
	type StoredErasureApproval,
} from "../erasure-deletion-storage";

/** What the database holds for the asset at the moment finalize re-checks it. */
export interface LiveErasureScope {
	availability: string;
	containers: ErasureContainerRef[];
	versionIds: string[];
}

interface MemoryOptions {
	/** Keys of included archive files that belong to erased versions, per archive id. */
	archiveObjectKeys?: Record<string, string[]>;
	/** The asset's rows as they stand when finalize runs; null when the Asset Record is gone. Left out: no re-check. */
	live?: () => LiveErasureScope | null;
	objectKeys: Record<string, string>;
}

function sameIds(left: readonly string[], right: readonly string[]) {
	return (
		left.length === right.length &&
		[...left].sort().join("\n") === [...right].sort().join("\n")
	);
}

const containerKey = (container: ErasureContainerRef) =>
	`${container.kind}:${container.id}`;

/**
 * An in-memory ErasureDeletionStorage. Like the database transaction,
 * finalize re-checks the live rows first and then writes everything or nothing.
 */
export function createMemoryErasureDeletionStorage(options: MemoryOptions) {
	const approvals = new Map<string, StoredErasureApproval>();
	const receipts = new Map<string, StoredDeletionReceipt>();
	const removalStarts = new Set<string>();
	const tombstones: ErasureTombstoneRow[] = [];
	const removedContainers: string[] = [];
	const erasedAssetRecords: string[] = [];
	const redactedVersionIds: string[] = [];
	const storage: ErasureDeletionStorage = {
		archiveObjectKeys: (_projectId, archiveIds) =>
			Promise.resolve(
				archiveIds.flatMap((id) => options.archiveObjectKeys?.[id] ?? [])
			),
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
			const live = options.live?.();
			if (options.live) {
				if (!live || live.availability === "erased") {
					return Promise.reject(
						new ErasureScopeChangedError(
							"The Asset Record is gone or already erased."
						)
					);
				}
				if (
					!(
						sameIds(live.versionIds, input.expected.assetVersionIds) &&
						sameIds(
							live.containers.map(containerKey),
							input.expected.containers.map(containerKey)
						)
					)
				) {
					return Promise.reject(
						new ErasureScopeChangedError(
							"The versions or containers differ from the proven scope."
						)
					);
				}
			}
			receipts.set(input.receipt.id, structuredClone(input.receipt));
			tombstones.push(...input.tombstones);
			removedContainers.push(...input.removeContainers.map((c) => c.id));
			erasedAssetRecords.push(input.assetRecordId);
			redactedVersionIds.push(
				...input.tombstones.map((row) => row.assetVersionId)
			);
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
		markRemovalStarted: (row) => {
			removalStarts.add(row.approvalId);
			return Promise.resolve();
		},
		objectKeys: (_projectId, ids) => {
			const found = new Map<string, string>();
			for (const id of ids) {
				const key = options.objectKeys[id];
				if (key) {
					found.set(id, key);
				}
			}
			return Promise.resolve(found);
		},
		removalStarted: (_projectId, approvalId) =>
			Promise.resolve(removalStarts.has(approvalId)),
	};
	return {
		approvals,
		erasedAssetRecords,
		receipts,
		redactedVersionIds,
		removalStarts,
		removedContainers,
		storage,
		tombstones,
	};
}
