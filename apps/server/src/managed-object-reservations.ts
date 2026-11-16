/** Durable ownership of temporary R2 objects while an operation may publish them. */
export interface ManagedObjectReservation {
	objectKey: string;
	operationId: string;
	ownerUserId: string;
	projectId: string;
	purpose:
		| "archive_import_zip"
		| "archive_import_file"
		| "archive_restore_copy";
}

export interface ManagedObjectReservations {
	/** Record a completed object write before any cleanup or release. */
	markSettled: (objectKey: string) => Promise<void>;
	/** Release only after deletion or verified publication under durable domain ownership. */
	release: (objectKey: string) => Promise<void>;
	/** Reserve before writing bytes; fails while this owner's erasure is active. */
	reserve: (reservation: ManagedObjectReservation) => Promise<void>;
}

export interface ManagedObjectErasureGate {
	/** Acquires an owner-wide gate only when no temporary objects remain. */
	beginErasure: (ownerUserId: string, operationId: string) => Promise<boolean>;
	/** Releases the gate only for the operation that acquired it. */
	endErasure: (ownerUserId: string, operationId: string) => Promise<void>;
	listOwner: (
		ownerUserId: string
	) => Promise<(ManagedObjectReservation & { writeSettled: boolean })[]>;
}
