import {
	type DeletionReceiptRecord,
	deletionReceiptContractSupport,
	deletionReceiptDigest,
	deletionReceiptRecordSchema,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import type { DeletionReceiptStore } from "@sprite-anvil/api/permanent-erasure-deletion-store";
import { RecordIntegrityError } from "@sprite-anvil/api/record-publication";
import type { ErasureDeletionStorage } from "./erasure-deletion-storage";
import {
	type ProjectLookupOptions,
	resolveProjectLookup,
} from "./project-lookup";

export type DeletionReceiptStoreOptions = ProjectLookupOptions & {
	storage: Pick<ErasureDeletionStorage, "findReceipt">;
};

/** Rereads a Deletion Receipt from its stored record and verifies its version and digest before showing it. */
export function createDeletionReceiptStore(
	options: DeletionReceiptStoreOptions
): DeletionReceiptStore {
	const lookupProject = resolveProjectLookup(options);
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
