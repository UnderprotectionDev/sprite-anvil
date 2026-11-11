export interface StoredDeliveryRefreshLock {
	bundleId: string;
	bundleManifestDigest: string;
	contractVersion: string;
	createdAt: Date;
	createdByUserId: string;
	destinationLabel: string;
	id: string;
	lockDigest: string;
	profileId: string;
	profileRevisionId: string;
	projectId: string;
	/** Digest of the apply request, so a repeated key with other content is a conflict. */
	requestDigest: string;
}

export interface StoredDeliveryRefreshLockFile {
	byteSize: number;
	path: string;
	sha256: string;
}

export type InsertDeliveryRefreshLockResult =
	| { status: "inserted" }
	/** The lock id already exists, or the files could not be written together. */
	| { status: "conflict" };

/** The persistent side of Delivery Refresh Locks. Locks and their files are only ever inserted. */
export interface DeliveryRefreshLockStorage {
	findLock: (
		projectId: string,
		lockId: string
	) => Promise<{
		files: StoredDeliveryRefreshLockFile[];
		lock: StoredDeliveryRefreshLock;
	} | null>;
	/** Writes the lock and all of its files in one transaction, or none of them. */
	insertLock: (
		lock: StoredDeliveryRefreshLock,
		files: StoredDeliveryRefreshLockFile[]
	) => Promise<InsertDeliveryRefreshLockResult>;
	/** Oldest first. */
	listLocks: (projectId: string) => Promise<StoredDeliveryRefreshLock[]>;
}
