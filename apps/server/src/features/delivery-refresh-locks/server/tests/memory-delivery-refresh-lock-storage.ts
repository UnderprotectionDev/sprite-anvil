import type {
	DeliveryRefreshLockStorage,
	StoredDeliveryRefreshLock,
	StoredDeliveryRefreshLockFile,
} from "../delivery-refresh-lock-storage";

/** An in-memory DeliveryRefreshLockStorage with the same all-or-nothing insert as the database store. */
export function createMemoryDeliveryRefreshLockStorage(): DeliveryRefreshLockStorage {
	const locks = new Map<
		string,
		{ files: StoredDeliveryRefreshLockFile[]; lock: StoredDeliveryRefreshLock }
	>();

	return {
		findLock: (projectId, lockId) => {
			const found = locks.get(lockId);
			return Promise.resolve(
				found?.lock.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertLock: (lock, files) => {
			if (locks.has(lock.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			locks.set(lock.id, structuredClone({ files, lock }));
			return Promise.resolve({ status: "inserted" });
		},
		listLocks: (projectId) =>
			Promise.resolve(
				[...locks.values()]
					.map((entry) => entry.lock)
					.filter((lock) => lock.projectId === projectId)
			),
	};
}
