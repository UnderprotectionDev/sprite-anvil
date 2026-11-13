import type {
	ErasureImpactSourceReader,
	ErasureImpactStore,
} from "@sprite-anvil/api/permanent-erasure-store";
import { createDeletionJob } from "./deletion-job";
import {
	createErasureApproval,
	type DeletionJobEnqueuer,
} from "./erasure-approval";
import type {
	ErasureDeletionStorage,
	ErasureObjectRemover,
} from "./erasure-deletion-storage";
import { createErasureObjectRemoval } from "./erasure-object-removal";
import { createErasureScopeProof } from "./erasure-scope-proof";
import type { ProjectLookupOptions } from "./project-lookup";

export type ErasureDeletionOperationsOptions = ProjectLookupOptions & {
	impactStore: ErasureImpactStore;
	now?: () => Date;
	objects: ErasureObjectRemover;
	operations: DeletionJobEnqueuer;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: (message: string) => Error;
	sourceReader: ErasureImpactSourceReader;
	storage: ErasureDeletionStorage;
	/** Builds the error the lifecycle retries, showing the user its message. */
	transientFailure: (message: string) => Error;
};

/**
 * The OPS-01 path of permanent erasure: `approve` records the user's approval
 * of one exact Erasure Impact Report and its Deletion Job, `execute` is the
 * handler of `deletion` operations.
 */
export function createErasureDeletionOperations(
	options: ErasureDeletionOperationsOptions
) {
	const proof = createErasureScopeProof(options);
	const removal = createErasureObjectRemoval(options);
	return {
		approve: createErasureApproval({ ...options, proof }).approve,
		execute: createDeletionJob({ ...options, proof, removal }).execute,
	};
}
