import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import {
	type ProjectArchiveRestoreInput,
	projectArchiveRestoreRequestDigest,
} from "@sprite-anvil/api/project-archive-restore";
import type { ProjectArchiveRestoreStore } from "@sprite-anvil/api/project-archive-restore-store";
import {
	IdempotencyConflictError,
	idempotentRecordId,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type { ProjectArchiveRestoreRequestStorage } from "./project-archive-restore-storage";

/** What the Background Operation lifecycle offers to enqueue an operation. */
interface OperationEnqueuer {
	enqueue: (request: {
		idempotencyKey: string;
		kind: "restore";
		projectId: string;
		scopeSummary: string;
		scopeTargetId: string;
		triggerSummary: string;
		userId: string;
	}) => Promise<BackgroundOperation>;
}

export interface ProjectArchiveRestoreOperationsOptions {
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	operations: OperationEnqueuer;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: (message: string) => Error;
	requests: ProjectArchiveRestoreRequestStorage;
	store: ProjectArchiveRestoreStore;
}

/**
 * The OPS-01 path of restoring: a restore that cannot finish inside an
 * interactive request is recorded as a Background Operation. The choice is
 * kept in a restore request, so the executor needs nothing but the operation
 * identity; the restore itself is the same atomic, idempotent store call an
 * interactive request uses, keyed the same way, so a repeated delivery, a
 * retry or an interactive repeat never makes a second project. Which restores
 * take this path is the caller's decision; no time or size threshold is
 * assumed here.
 */
export function createProjectArchiveRestoreOperations(
	db: Database,
	options: ProjectArchiveRestoreOperationsOptions
) {
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		/** Records the restore request and its authoritative Background Operation; null when the project is not found. */
		async request(userId: string, input: ProjectArchiveRestoreInput) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const restoreId = await idempotentRecordId(
				{
					kind: "project-archive-restore",
					projectId: input.projectId,
					targetId: input.archiveId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await projectArchiveRestoreRequestDigest(input);
			const inserted = await options.requests.insert({
				archiveId: input.archiveId,
				createdAt: now(),
				id: restoreId,
				idempotencyKey: input.idempotencyKey,
				projectId: input.projectId,
				projectName: input.name,
				requestDigest,
				requestedByUserId: userId,
			});
			if (
				inserted.status === "existing" &&
				inserted.existing.requestDigest !== requestDigest
			) {
				throw new IdempotencyConflictError("Project Archive restore");
			}
			return await options.operations.enqueue({
				idempotencyKey: `project-archive-restore:${input.idempotencyKey}`,
				kind: "restore",
				projectId: input.projectId,
				scopeSummary: `Restore of Project Archive ${input.archiveId} into a new project`,
				scopeTargetId: restoreId,
				triggerSummary: "Restore requested by the project owner",
				userId,
			});
		},

		/** The executor for `restore` operations; returns the result summary the user sees. */
		async execute(context: {
			operation: Pick<BackgroundOperation, "projectId" | "scopeTargetId">;
		}) {
			const { operation } = context;
			const request = operation.scopeTargetId
				? await options.requests.find(
						operation.projectId,
						operation.scopeTargetId
					)
				: null;
			if (!request) {
				throw options.permanentFailure("The restore request was not found.");
			}
			const result = await options.store
				.restore(request.requestedByUserId, {
					archiveId: request.archiveId,
					idempotencyKey: request.idempotencyKey,
					name: request.projectName,
					projectId: request.projectId,
				})
				.catch((error: unknown) => {
					if (error instanceof IdempotencyConflictError) {
						throw options.permanentFailure(error.message);
					}
					throw error;
				});
			if (!result) {
				throw options.permanentFailure(
					"The project or archive is no longer available."
				);
			}
			if (result.status === "rejected") {
				throw options.permanentFailure(
					`The project was not restored: ${result.reason}.`
				);
			}
			return `Project ${result.restore.restoredProjectId} ${result.status} from Project Archive ${result.restore.archiveId}.`;
		},
	};
}
