import {
	type DeletionReceiptRecord,
	deletionReceiptContractSupport,
	deletionReceiptDigest,
	deletionReceiptRecordSchema,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import type { DeletionReceiptStore } from "@sprite-anvil/api/permanent-erasure-deletion-store";
import { RecordIntegrityError } from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type { ErasureDeletionStorage } from "./erasure-deletion-storage";

export interface ErasureReceiptStoreOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	storage: Pick<ErasureDeletionStorage, "findReceipt">;
}

/** Rereads a Deletion Receipt from its stored record and verifies its version and digest before showing it. */
export function createErasureReceiptStore(
	options: ErasureReceiptStoreOptions & { db?: Database }
): DeletionReceiptStore {
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) => {
			if (!options.db) {
				throw new Error("A database or a project lookup is required.");
			}
			return getProjectForUser(options.db, userId, projectId);
		});
	return {
		async get(
			userId,
			projectId,
			receiptId
		): Promise<DeletionReceiptRecord | null> {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await options.storage.findReceipt(projectId, receiptId);
			if (!stored) {
				return null;
			}
			if (
				deletionReceiptContractSupport(stored.receipt.contractVersion)
					.status !== "supported"
			) {
				throw new RecordIntegrityError(
					"The Deletion Receipt uses a contract version this build does not read."
				);
			}
			const parsed = deletionReceiptRecordSchema.safeParse({
				...stored.receipt,
				receiptDigest: stored.receiptDigest,
			});
			if (
				!parsed.success ||
				(await deletionReceiptDigest(stored.receipt)) !== stored.receiptDigest
			) {
				throw new RecordIntegrityError(
					"The Deletion Receipt failed verification: its content no longer matches its digest."
				);
			}
			return parsed.data;
		},
	};
}
