import type { ErasureImpactScope } from "@sprite-anvil/api/permanent-erasure";
import type {
	ErasureDeletionStorage,
	ErasureObjectRemover,
	StoredErasureApproval,
} from "./erasure-deletion-storage";

export interface ErasureObjectRemovalOptions {
	objects: ErasureObjectRemover;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: (message: string) => Error;
	storage: Pick<ErasureDeletionStorage, "archiveObjectKeys" | "objectKeys">;
	/** Builds the error the lifecycle retries, showing the user its message. */
	transientFailure: (message: string) => Error;
}

/** Finds and removes the stored objects an approved scope erases. */
export function createErasureObjectRemoval(
	options: ErasureObjectRemovalOptions
) {
	const { objects, storage } = options;

	return {
		/** Every stored object the approved scope removes: the managed copies and the selected archives' copies of them. */
		async objectKeysToRemove(
			approval: Pick<
				StoredErasureApproval,
				"projectId" | "selectedContainerIds"
			>,
			scope: ErasureImpactScope
		) {
			const versionIds = scope.managedCopies.map((copy) => copy.assetVersionId);
			const keys = await storage.objectKeys(approval.projectId, versionIds);
			const objectKeys = new Set<string>();
			for (const versionId of versionIds) {
				const key = keys.get(versionId);
				if (key === undefined) {
					throw options.permanentFailure(
						"Some managed copies have no stored object to remove, so no object was removed by this attempt."
					);
				}
				objectKeys.add(key);
			}
			// Copies a selected Project Archive keeps of the erased content go with it.
			const selectedArchiveIds = scope.containers
				.filter(
					(container) =>
						container.kind === "project_archive" &&
						approval.selectedContainerIds.includes(container.id)
				)
				.map((container) => container.id);
			for (const key of await storage.archiveObjectKeys(
				approval.projectId,
				selectedArchiveIds,
				versionIds
			)) {
				objectKeys.add(key);
			}
			return [...objectKeys];
		},

		/** Removes the objects one at a time; a failure says how many were already removed. */
		async removeObjects(objectKeys: string[]) {
			let removed = 0;
			for (const key of objectKeys) {
				try {
					// biome-ignore lint/performance/noAwaitInLoops: Objects are removed one at a time so a failure leaves a known prefix.
					await objects.delete(key);
				} catch (error) {
					const failure = options.transientFailure(
						`Removing stored objects failed after ${removed} of ${objectKeys.length} were removed. The removed objects stay removed; no receipt exists yet, and the next attempt removes the rest and completes the erasure.`
					);
					failure.cause = error;
					throw failure;
				}
				removed += 1;
			}
		},
	};
}
