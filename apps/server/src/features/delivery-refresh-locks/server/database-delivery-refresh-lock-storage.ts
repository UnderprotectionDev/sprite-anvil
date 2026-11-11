import type { Database } from "@sprite-anvil/db";
import {
	deliveryRefreshLockFiles,
	deliveryRefreshLocks,
} from "@sprite-anvil/db/schema/delivery-refresh-locks";
import { and, asc, eq } from "drizzle-orm";
import type {
	DeliveryRefreshLockStorage,
	StoredDeliveryRefreshLock,
} from "./delivery-refresh-lock-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toLock(
	row: typeof deliveryRefreshLocks.$inferSelect
): StoredDeliveryRefreshLock {
	return {
		bundleId: row.bundleId,
		bundleManifestDigest: row.bundleManifestDigest,
		contractVersion: row.contractVersion,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		destinationLabel: row.destinationLabel,
		id: row.id,
		lockDigest: row.lockDigest,
		profileId: row.profileId,
		profileRevisionId: row.profileRevisionId,
		projectId: row.projectId,
		requestDigest: row.requestDigest,
	};
}

export function createDatabaseDeliveryRefreshLockStorage(
	db: Database
): DeliveryRefreshLockStorage {
	return {
		async findLock(projectId, lockId) {
			const [row] = await db
				.select()
				.from(deliveryRefreshLocks)
				.where(
					and(
						eq(deliveryRefreshLocks.projectId, projectId),
						eq(deliveryRefreshLocks.id, lockId)
					)
				);
			if (!row) {
				return null;
			}
			const files = await db
				.select({
					byteSize: deliveryRefreshLockFiles.byteSize,
					path: deliveryRefreshLockFiles.path,
					sha256: deliveryRefreshLockFiles.sha256,
				})
				.from(deliveryRefreshLockFiles)
				.where(eq(deliveryRefreshLockFiles.lockId, lockId))
				.orderBy(asc(deliveryRefreshLockFiles.path));
			return { files, lock: toLock(row) };
		},
		async insertLock(lock, files) {
			try {
				await db.transaction(async (tx) => {
					await tx.insert(deliveryRefreshLocks).values(lock);
					await tx
						.insert(deliveryRefreshLockFiles)
						.values(files.map((file) => ({ ...file, lockId: lock.id })));
				});
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listLocks(projectId) {
			const rows = await db
				.select()
				.from(deliveryRefreshLocks)
				.where(eq(deliveryRefreshLocks.projectId, projectId))
				.orderBy(
					asc(deliveryRefreshLocks.createdAt),
					asc(deliveryRefreshLocks.id)
				);
			return rows.map(toLock);
		},
	};
}
