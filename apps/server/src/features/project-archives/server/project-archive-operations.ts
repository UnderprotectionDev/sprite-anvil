import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ProjectArchiveStore } from "@sprite-anvil/api/project-archive-store";
import {
	type ProjectArchiveCreateInput,
	projectArchiveRequestDigest,
} from "@sprite-anvil/api/project-archives";
import {
	IdempotencyConflictError,
	idempotentRecordId,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type { ProjectArchiveRequestStorage } from "./project-archive-storage";

/** What the Background Operation lifecycle offers to enqueue an operation. */
interface OperationEnqueuer {
	enqueue: (request: {
		idempotencyKey: string;
		kind: "archive";
		projectId: string;
		scopeSummary: string;
		scopeTargetId: string;
		triggerSummary: string;
		userId: string;
	}) => Promise<BackgroundOperation>;
}

/** Failure the lifecycle shows the user without retrying. */
export type ArchiveHandlerFailure = (message: string) => Error;

export interface ProjectArchiveOperationsOptions {
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	operations: OperationEnqueuer;
	/** Builds the error the lifecycle treats as a failure another attempt cannot fix. */
	permanentFailure: ArchiveHandlerFailure;
	requests: ProjectArchiveRequestStorage;
	store: ProjectArchiveStore;
}

/**
 * The OPS-01 path of archiving: an archive that cannot finish inside an
 * interactive request is recorded as a Background Operation. The selection is
 * kept in an archive request, so the executor needs nothing but the operation
 * identity; the archive itself is made by the same atomic, idempotent store
 * call an interactive request uses, keyed the same way, so a repeated delivery
 * or retry never makes a second archive.
 */
export function createProjectArchiveOperations(
	db: Database,
	options: ProjectArchiveOperationsOptions
) {
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		/** Records the archive request and its authoritative Background Operation; null when the project is not found. */
		async request(userId: string, input: ProjectArchiveCreateInput) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const archiveId = await idempotentRecordId(
				{ kind: "project-archive", projectId: input.projectId, userId },
				input.idempotencyKey
			);
			const requestDigest = await projectArchiveRequestDigest(input);
			const inserted = await options.requests.insert({
				createdAt: now(),
				id: archiveId,
				idempotencyKey: input.idempotencyKey,
				projectId: input.projectId,
				requestDigest,
				requestedByUserId: userId,
				workingFileIds: [...input.workingFileIds],
			});
			if (
				inserted.status === "existing" &&
				inserted.existing.requestDigest !== requestDigest
			) {
				throw new IdempotencyConflictError("Project Archive");
			}
			return await options.operations.enqueue({
				idempotencyKey: `project-archive:${input.idempotencyKey}`,
				kind: "archive",
				projectId: input.projectId,
				scopeSummary: `Project Archive of ${input.workingFileIds.length} selected working files`,
				scopeTargetId: archiveId,
				triggerSummary: "Archive requested by the project owner",
				userId,
			});
		},

		/** The executor for `archive` operations; returns the result summary the user sees. */
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
				throw options.permanentFailure("The archive request was not found.");
			}
			const result = await options.store.create(request.requestedByUserId, {
				idempotencyKey: request.idempotencyKey,
				projectId: request.projectId,
				workingFileIds: request.workingFileIds,
			});
			if (!result) {
				throw options.permanentFailure("The project is no longer available.");
			}
			if (result.status === "rejected") {
				throw options.permanentFailure(
					`The archive was not created: ${result.reason}.`
				);
			}
			return `Project Archive ${result.archive.id} ${result.status}.`;
		},
	};
}
