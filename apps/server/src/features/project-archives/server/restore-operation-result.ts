import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { RestoreOperationReadInput } from "@sprite-anvil/api/project-archive-restore";
import type { ProjectArchiveRestoreStore } from "@sprite-anvil/api/project-archive-restore-store";
import { idempotentRecordId } from "@sprite-anvil/api/record-publication";
import type { ArchiveImportRequestStorage } from "./project-archive-import-storage";
import type { ProjectArchiveRestoreRequestStorage } from "./project-archive-restore-storage";

export function createRestoreOperationResultReader({
	managedRequests,
	importRequests,
	store,
}: {
	managedRequests?: ProjectArchiveRestoreRequestStorage;
	importRequests?: ArchiveImportRequestStorage;
	store: ProjectArchiveRestoreStore;
}) {
	return async (
		userId: string,
		input: RestoreOperationReadInput,
		operation: BackgroundOperation
	) => {
		if (!(validOperation(operation, input) && operation.scopeTargetId)) {
			return null;
		}
		const requestId = operation.scopeTargetId;
		if (input.task === "restore") {
			return readManagedRestore(
				managedRequests,
				store,
				userId,
				input,
				operation,
				requestId
			);
		}
		const request = await importRequests?.find(input.projectId, requestId);
		if (!request || request.requestedByUserId !== userId) {
			return null;
		}
		if (operation.status !== "completed" || !request.completedSummary) {
			return { restore: null };
		}
		return {
			restore: await findImportedRestore(
				store,
				userId,
				input.projectId,
				request.idempotencyKey
			),
		};
	};
}

async function findImportedRestore(
	store: ProjectArchiveRestoreStore,
	userId: string,
	projectId: string,
	idempotencyKey: string
) {
	// The persisted request key and the canonical restore identity provide a
	// durable structured result for legacy as well as new ZIP imports.
	const catalog = await store.list(userId, projectId);
	const candidates = await Promise.all(
		(catalog?.restores ?? []).map(async (item) => ({
			item,
			matches:
				item.id ===
				(await idempotentRecordId(
					{
						kind: "project-archive-restore",
						projectId,
						targetId: item.archiveId,
						userId,
					},
					idempotencyKey
				)),
		}))
	);
	const matched = candidates.filter((candidate) => candidate.matches);
	if (matched.length !== 1) {
		return null;
	}
	return store.get(userId, projectId, matched[0]?.item.id ?? "");
}

function validOperation(
	operation: BackgroundOperation,
	input: RestoreOperationReadInput
) {
	return (
		operation.kind === "restore" &&
		operation.projectId === input.projectId &&
		operation.id === input.operationId
	);
}

async function readManagedRestore(
	managedRequests: ProjectArchiveRestoreRequestStorage | undefined,
	store: ProjectArchiveRestoreStore,
	userId: string,
	input: Extract<RestoreOperationReadInput, { task: "restore" }>,
	operation: BackgroundOperation,
	requestId: string
) {
	const request = await managedRequests?.find(input.projectId, requestId);
	if (
		!request ||
		request.requestedByUserId !== userId ||
		request.archiveId !== input.archiveId
	) {
		return null;
	}
	const restore =
		operation.status === "completed"
			? await store.get(userId, input.projectId, requestId)
			: null;
	if (restore && restore.archiveId !== input.archiveId) {
		return null;
	}
	return { restore };
}
