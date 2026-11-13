import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ErasureImpactScope } from "@sprite-anvil/api/permanent-erasure";
import {
	buildDeletionReceipt,
	deletionReceiptDigest,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import {
	type ErasureDeletionStorage,
	ErasureScopeChangedError,
	type StoredErasureApproval,
} from "./erasure-deletion-storage";
import type { createErasureObjectRemoval } from "./erasure-object-removal";
import type { ErasureScopeProof } from "./erasure-scope-proof";
import {
	type ProjectLookupOptions,
	resolveProjectLookup,
} from "./project-lookup";

export type DeletionJobOptions = ProjectLookupOptions & {
	now?: () => Date;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: (message: string) => Error;
	proof: ErasureScopeProof;
	removal: ReturnType<typeof createErasureObjectRemoval>;
	storage: ErasureDeletionStorage;
};

/**
 * The handler of `deletion` operations. It re-proves the approved scope is
 * still the exact scope, passes one last cancel checkpoint, then removes
 * objects with no further checkpoint (the irreversible boundary) and finalizes
 * the receipt, the Erasure Tombstones and the whole-container removal in one
 * atomic write. The boundary is recorded before the first object is removed, so
 * a retry after a partial removal never passes a checkpoint again.
 *
 * Removing objects and finalizing are not one atomic step: a failure between
 * them leaves some objects removed and no receipt. That is safe because object
 * removal is idempotent and the scope is read from rows the removal never
 * touches, so a retry removes the rest and finalizes.
 */
export function createDeletionJob(options: DeletionJobOptions) {
	const { permanentFailure, proof, removal, storage } = options;
	const lookupProject = resolveProjectLookup(options);
	const now = options.now ?? (() => new Date());

	/** The scope the approval was given for, proven against the records as they stand; fails the job when it cannot be. */
	async function proveApprovedScope(
		approval: StoredErasureApproval
	): Promise<ErasureImpactScope> {
		const userId = approval.approvedByUserId;
		// The approving user's access carries the reads below; without it they would all look like missing records.
		if ((await lookupProject(userId, approval.projectId)) === null) {
			throw permanentFailure(
				"The user who approved this erasure no longer has access to the project, so no object was removed by this attempt. Prepare and approve a new Erasure Impact Report with a user who has access."
			);
		}
		const read = await proof.readReport(
			userId,
			approval.projectId,
			approval.reportId
		);
		if (read.status === "not_found") {
			throw permanentFailure(
				"The approved Erasure Impact Report was not found, so no object was removed by this attempt."
			);
		}
		if (read.status === "unreadable") {
			throw permanentFailure(
				"The approved Erasure Impact Report cannot be read or verified by this build, so no object was removed by this attempt."
			);
		}
		const scope = await proof.provenScope(
			userId,
			read.report,
			approval.reportDigest
		);
		if (!scope) {
			throw permanentFailure(
				"The scope changed after it was approved, so no object was removed by this attempt. Prepare a new Erasure Impact Report and approve it again."
			);
		}
		return scope;
	}

	/** Writes the receipt, the tombstones and the whole-container removal atomically; a scope that moved on since the proof fails the job. */
	async function finalize(
		approval: StoredErasureApproval,
		operationId: string,
		scope: ErasureImpactScope
	) {
		const completedAt = now();
		const receipt = buildDeletionReceipt({
			approval: {
				approvedAt: approval.createdAt,
				approvedByUserId: approval.approvedByUserId,
				id: approval.id,
				reportId: approval.reportId,
				selectedContainerIds: approval.selectedContainerIds,
			},
			completedAt,
			operationId,
			reportDigest: approval.reportDigest,
			scope,
		});
		const selected = new Set(approval.selectedContainerIds);
		const versionIds = scope.managedCopies.map((copy) => copy.assetVersionId);
		const containers = scope.containers.map((container) => ({
			id: container.id,
			kind: container.kind,
		}));
		try {
			return await storage.finalize({
				assetRecordId: scope.target.assetRecordId,
				expected: { assetVersionIds: versionIds, containers },
				projectId: approval.projectId,
				receipt: {
					id: approval.id,
					projectId: approval.projectId,
					receipt,
					receiptDigest: await deletionReceiptDigest(receipt),
				},
				removeContainers: containers.filter((container) =>
					selected.has(container.id)
				),
				tombstones: versionIds.map((assetVersionId) => ({
					assetRecordId: scope.target.assetRecordId,
					assetVersionId,
					erasedAt: completedAt,
					projectId: approval.projectId,
					receiptId: approval.id,
				})),
			});
		} catch (error) {
			if (error instanceof ErasureScopeChangedError) {
				const failure = permanentFailure(
					"The scope changed while stored objects were being removed, so no Deletion Receipt was written. Objects already removed stay removed; prepare a new Erasure Impact Report to review what remains."
				);
				failure.cause = error;
				throw failure;
			}
			throw error;
		}
	}

	return {
		/** Runs one delivery of a `deletion` operation; returns the result summary the user sees. */
		async execute(context: {
			checkpoint: () => Promise<void>;
			operation: Pick<
				BackgroundOperation,
				"id" | "projectId" | "scopeTargetId"
			>;
		}) {
			const { operation } = context;
			const approval = operation.scopeTargetId
				? await storage.findApproval(
						operation.projectId,
						operation.scopeTargetId
					)
				: null;
			if (!approval) {
				throw permanentFailure("The erasure approval was not found.");
			}
			const done = await storage.findReceipt(approval.projectId, approval.id);
			if (done) {
				return `Deletion Receipt ${done.id} replayed.`;
			}

			const scope = await proveApprovedScope(approval);
			const objectKeys = await removal.objectKeysToRemove(approval, scope);

			// The last point where the work can still stop safely: once removal
			// started, even in an earlier attempt, the operation reports its real
			// result, never Cancelled.
			if (!(await storage.removalStarted(approval.projectId, approval.id))) {
				await context.checkpoint();
				await storage.markRemovalStarted({
					approvalId: approval.id,
					projectId: approval.projectId,
					startedAt: now(),
				});
			}
			await removal.removeObjects(objectKeys);

			const finalized = await finalize(approval, operation.id, scope);
			return `Deletion Receipt ${approval.id} ${finalized.status === "finalized" ? "created" : "replayed"}.`;
		},
	};
}
