import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import {
	buildErasureImpactScope,
	type ErasureImpactReport,
	type ErasureImpactScope,
	erasureImpactDigest,
} from "@sprite-anvil/api/permanent-erasure";
import {
	buildDeletionReceipt,
	deletionReceiptDigest,
	type ErasureAuthorizeInput,
	type ErasureAuthorizeResult,
	erasureAuthorizeRequestDigest,
	selectedErasureCounts,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import type {
	ErasureImpactSourceReader,
	ErasureImpactStore,
} from "@sprite-anvil/api/permanent-erasure-store";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import type {
	ErasureDeletionStorage,
	ErasureObjectRemover,
	StoredErasureAuthorization,
} from "./erasure-deletion-storage";
import {
	type ProjectLookupOptions,
	resolveProjectLookup,
} from "./project-lookup";

/** What the Background Operation lifecycle offers to enqueue an operation. */
interface OperationEnqueuer {
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

export interface ErasureDeletionOperationsOptions extends ProjectLookupOptions {
	impactStore: ErasureImpactStore;
	now?: () => Date;
	objects: ErasureObjectRemover;
	operations: OperationEnqueuer;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: (message: string) => Error;
	sourceReader: ErasureImpactSourceReader;
	storage: ErasureDeletionStorage;
	/** Builds the error the lifecycle retries, showing the user its message. */
	transientFailure: (message: string) => Error;
}

/**
 * The OPS-01 path of permanent erasure. `authorize` is the explicit user
 * approval of one exact Erasure Impact Report: it records the approval and the
 * Deletion Job together, keyed by the idempotency key. `execute` is the
 * handler of `deletion` operations: it re-proves the approved scope is still
 * the exact scope, passes one last cancel checkpoint, then removes objects with
 * no further checkpoint (the irreversible boundary) and finalizes the receipt,
 * the Erasure Tombstones and the whole-container removal in one atomic write.
 * Removing objects and finalizing are not one atomic step: a failure between
 * them leaves some objects removed and no receipt. That is safe because
 * object removal is idempotent and the scope is read from rows the removal
 * never touches, so a retry removes the rest and finalizes.
 */
export function createErasureDeletionOperations(
	options: ErasureDeletionOperationsOptions & { db?: Database }
) {
	const { impactStore, sourceReader, storage } = options;
	const lookupProject = resolveProjectLookup(options);
	const now = options.now ?? (() => new Date());

	/** The exact scope of the approved report as it stands now; null when it can no longer be built. */
	async function currentScope(userId: string, report: ErasureImpactReport) {
		const source = await sourceReader.read(
			userId,
			report.projectId,
			report.target.assetRecordId
		);
		if (!source) {
			return null;
		}
		const built = buildErasureImpactScope(source, {
			projectId: report.projectId,
			// The report's own schedule, so a later schedule change is not mistaken for a scope change.
			retention:
				report.backup.status === "scheduled"
					? {
							purgeWindowDays: report.backup.purgeWindowDays,
							version: report.backup.retentionScheduleVersion,
						}
					: null,
		});
		return built.ok ? built.scope : null;
	}

	/** Every stored object the approved scope removes: the managed copies and the selected archives' copies of them. */
	async function objectKeysToRemove(
		authorization: StoredErasureAuthorization,
		scope: ErasureImpactScope,
		versionIds: string[]
	) {
		const keys = await storage.objectKeys(authorization.projectId, versionIds);
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
					authorization.selectedContainerIds.includes(container.id)
			)
			.map((container) => container.id);
		for (const key of await storage.archiveObjectKeys(
			authorization.projectId,
			selectedArchiveIds,
			versionIds
		)) {
			objectKeys.add(key);
		}
		return [...objectKeys];
	}

	/** Removes the objects one at a time; a failure says how many were already removed. */
	async function removeObjects(objectKeys: string[]) {
		let removed = 0;
		for (const key of objectKeys) {
			try {
				// biome-ignore lint/performance/noAwaitInLoops: Objects are removed one at a time so a failure leaves a known prefix.
				await options.objects.delete(key);
			} catch (error) {
				const failure = options.transientFailure(
					`Removing stored objects failed after ${removed} of ${objectKeys.length} were removed. The removed objects stay removed; no receipt exists yet, and the next attempt removes the rest and completes the erasure.`
				);
				failure.cause = error;
				throw failure;
			}
			removed += 1;
		}
	}

	async function readReport(
		userId: string,
		projectId: string,
		reportId: string
	) {
		try {
			return await impactStore.get(userId, projectId, reportId);
		} catch (error) {
			if (error instanceof RecordIntegrityError) {
				return "unreadable" as const;
			}
			throw error;
		}
	}

	return {
		/** Records the user's approval and its Deletion Job; null when the project is not found. */
		async authorize(
			userId: string,
			input: ErasureAuthorizeInput
		): Promise<ErasureAuthorizeResult<BackgroundOperation> | null> {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const report = await readReport(userId, input.projectId, input.reportId);
			if (report === "unreadable") {
				return { reason: "report_unreadable", status: "rejected" };
			}
			if (!report) {
				return { reason: "report_not_found", status: "rejected" };
			}
			if (report.reportDigest !== input.reportDigest) {
				return { reason: "report_changed", status: "rejected" };
			}
			const scope = await currentScope(userId, report);
			if (
				!scope ||
				(await erasureImpactDigest(scope)) !== report.reportDigest
			) {
				return { reason: "report_changed", status: "rejected" };
			}
			const known = new Set(scope.containers.map((container) => container.id));
			const unknown = input.selectedContainerIds.filter((id) => !known.has(id));
			if (unknown.length > 0) {
				return {
					containerIds: unknown,
					reason: "unknown_container",
					status: "rejected",
				};
			}
			const expected = selectedErasureCounts(scope, input.selectedContainerIds);
			const countKeys = Object.keys(expected) as (keyof typeof expected)[];
			if (countKeys.some((key) => expected[key] !== input.confirmed[key])) {
				return { reason: "counts_mismatch", status: "rejected" };
			}

			const authorizationId = await idempotentRecordId(
				{
					assetRecordId: report.target.assetRecordId,
					kind: "erasure-authorization",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await erasureAuthorizeRequestDigest(input);
			const inserted = await storage.insertAuthorization({
				authorizedByUserId: userId,
				confirmed: input.confirmed,
				createdAt: now(),
				id: authorizationId,
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
			const operation = await options.operations.enqueue({
				idempotencyKey: `erasure:${input.idempotencyKey}`,
				kind: "deletion",
				projectId: input.projectId,
				scopeSummary: `Permanent erasure of ${scope.managedCopies.length} managed copies and ${input.selectedContainerIds.length} whole containers`,
				scopeTargetId: authorizationId,
				triggerSummary: "Erasure authorized by the project owner",
				userId,
			});
			return { operation, status: "accepted" };
		},

		/** The executor for `deletion` operations; returns the result summary the user sees. */
		async execute(context: {
			checkpoint: () => Promise<void>;
			operation: Pick<
				BackgroundOperation,
				"id" | "projectId" | "scopeTargetId"
			>;
		}) {
			const { operation } = context;
			const authorization = operation.scopeTargetId
				? await storage.findAuthorization(
						operation.projectId,
						operation.scopeTargetId
					)
				: null;
			if (!authorization) {
				throw options.permanentFailure(
					"The erasure authorization was not found."
				);
			}
			const done = await storage.findReceipt(
				authorization.projectId,
				authorization.id
			);
			if (done) {
				return `Deletion Receipt ${done.id} replayed.`;
			}

			const report = await readReport(
				authorization.authorizedByUserId,
				authorization.projectId,
				authorization.reportId
			);
			if (!report || report === "unreadable") {
				throw options.permanentFailure(
					"The approved Erasure Impact Report cannot be read, so no object was removed by this attempt."
				);
			}
			const scope = await currentScope(
				authorization.authorizedByUserId,
				report
			);
			if (
				report.reportDigest !== authorization.reportDigest ||
				!scope ||
				(await erasureImpactDigest(scope)) !== authorization.reportDigest
			) {
				throw options.permanentFailure(
					"The scope changed after it was approved, so no object was removed by this attempt. Prepare a new Erasure Impact Report and approve it again."
				);
			}
			const versionIds = scope.managedCopies.map((copy) => copy.assetVersionId);
			const objectKeys = await objectKeysToRemove(
				authorization,
				scope,
				versionIds
			);

			// The last point where the work can still stop safely: after the first
			// object is removed the operation reports its real result, never Cancelled.
			await context.checkpoint();
			await removeObjects(objectKeys);

			const completedAt = now();
			const receipt = buildDeletionReceipt({
				authorization: {
					authorizedAt: authorization.createdAt,
					authorizedByUserId: authorization.authorizedByUserId,
					id: authorization.id,
					reportId: authorization.reportId,
					selectedContainerIds: authorization.selectedContainerIds,
				},
				completedAt,
				operationId: operation.id,
				reportDigest: authorization.reportDigest,
				scope,
			});
			const selected = new Set(authorization.selectedContainerIds);
			const finalized = await storage.finalize({
				assetRecordId: scope.target.assetRecordId,
				projectId: authorization.projectId,
				receipt: {
					id: authorization.id,
					projectId: authorization.projectId,
					receipt,
					receiptDigest: await deletionReceiptDigest(receipt),
				},
				removeContainers: scope.containers
					.filter((container) => selected.has(container.id))
					.map((container) => ({ id: container.id, kind: container.kind })),
				tombstones: versionIds.map((assetVersionId) => ({
					assetRecordId: scope.target.assetRecordId,
					assetVersionId,
					erasedAt: completedAt,
					projectId: authorization.projectId,
					receiptId: authorization.id,
				})),
			});
			return `Deletion Receipt ${authorization.id} ${finalized.status === "finalized" ? "created" : "replayed"}.`;
		},
	};
}
