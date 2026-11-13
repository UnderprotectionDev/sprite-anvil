import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import {
	confirmedCountsMatch,
	type ErasureApprovalInput,
	erasureApprovalRequestDigest,
	unknownErasureContainerIds,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import type { ErasureApprovalOperations } from "@sprite-anvil/api/permanent-erasure-deletion-store";
import {
	IdempotencyConflictError,
	idempotentRecordId,
} from "@sprite-anvil/api/record-publication";
import type { ErasureDeletionStorage } from "./erasure-deletion-storage";
import type { ErasureScopeProof } from "./erasure-scope-proof";
import {
	type ProjectLookupOptions,
	resolveProjectLookup,
} from "./project-lookup";

/** What the Background Operation lifecycle offers to enqueue an operation. */
export interface DeletionJobEnqueuer {
	enqueue: (request: {
		idempotencyKey: string;
		kind: "deletion";
		projectId: string;
		scopeSummary: string;
		scopeTargetId: string;
		triggerSummary: string;
		userId: string;
	}) => Promise<BackgroundOperation>;
}

export type ErasureApprovalOptions = ProjectLookupOptions & {
	now?: () => Date;
	operations: DeletionJobEnqueuer;
	proof: ErasureScopeProof;
	storage: Pick<ErasureDeletionStorage, "findApproval" | "insertApproval">;
};

/**
 * The explicit user approval of one exact Erasure Impact Report. It records the
 * approval and its Deletion Job together, keyed by the idempotency key. The key
 * is looked up before the scope is proven again: finishing the erasure changes
 * the records the report was built from, so a repeat of a finished approval
 * must answer with the first Deletion Job, not with a changed scope.
 */
export function createErasureApproval(
	options: ErasureApprovalOptions
): ErasureApprovalOperations {
	const { proof, storage } = options;
	const lookupProject = resolveProjectLookup(options);
	const now = options.now ?? (() => new Date());

	/** The Deletion Job of an approval; enqueueing is idempotent, so a repeat returns the first one. */
	function enqueueJob(
		userId: string,
		input: ErasureApprovalInput,
		approvalId: string
	) {
		return options.operations.enqueue({
			idempotencyKey: `erasure:${input.idempotencyKey}`,
			kind: "deletion",
			projectId: input.projectId,
			// Only the approved numbers, so the summary is the same on every repeat.
			scopeSummary: `Permanent erasure of ${input.confirmed.managedCopies} managed copies and ${input.selectedContainerIds.length} whole containers`,
			scopeTargetId: approvalId,
			triggerSummary: "Erasure approved by the project owner",
			userId,
		});
	}

	return {
		async approve(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const approvalId = await idempotentRecordId(
				{
					kind: "erasure-approval",
					projectId: input.projectId,
					targetId: input.reportId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await erasureApprovalRequestDigest(input);

			const earlier = await storage.findApproval(input.projectId, approvalId);
			if (earlier) {
				if (earlier.requestDigest !== requestDigest) {
					throw new IdempotencyConflictError("Deletion Job");
				}
				return {
					operation: await enqueueJob(userId, input, approvalId),
					status: "accepted",
				};
			}

			const read = await proof.readReport(
				userId,
				input.projectId,
				input.reportId
			);
			if (read.status === "unreadable") {
				return { reason: "report_unreadable", status: "rejected" };
			}
			if (read.status === "not_found") {
				return { reason: "report_not_found", status: "rejected" };
			}
			const { report } = read;
			const scope = await proof.provenScope(userId, report, input.reportDigest);
			if (!scope) {
				return { reason: "report_changed", status: "rejected" };
			}
			const unknown = unknownErasureContainerIds(
				scope,
				input.selectedContainerIds
			);
			if (unknown.length > 0) {
				return {
					containerIds: unknown,
					reason: "unknown_container",
					status: "rejected",
				};
			}
			if (
				!confirmedCountsMatch(
					scope,
					input.selectedContainerIds,
					input.confirmed
				)
			) {
				return { reason: "counts_mismatch", status: "rejected" };
			}

			const inserted = await storage.insertApproval({
				approvedByUserId: userId,
				confirmed: input.confirmed,
				createdAt: now(),
				id: approvalId,
				idempotencyKey: input.idempotencyKey,
				projectId: input.projectId,
				reportDigest: report.reportDigest,
				reportId: report.id,
				requestDigest,
				selectedContainerIds: [...input.selectedContainerIds],
			});
			if (
				inserted.status === "existing" &&
				inserted.existing.requestDigest !== requestDigest
			) {
				throw new IdempotencyConflictError("Deletion Job");
			}
			return {
				operation: await enqueueJob(userId, input, approvalId),
				status: "accepted",
			};
		},
	};
}
