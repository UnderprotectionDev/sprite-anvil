import { expect, test } from "bun:test";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ProjectArchiveRestore } from "@sprite-anvil/api/project-archive-restore";
import { idempotentRecordId } from "@sprite-anvil/api/record-publication";
import { createRestoreOperationResultReader } from "../restore-operation-result";

const ownerId = "owner";
const projectId = "10000000-0000-4000-8000-000000000001";
const archiveId = "10000000-0000-4000-8000-000000000002";
const requestId = "10000000-0000-4000-8000-000000000003";
const operationId = "10000000-0000-4000-8000-000000000004";
const newProjectId = "10000000-0000-4000-8000-000000000005";
const key = "10000000-0000-4000-8000-000000000006";
const now = new Date().toISOString();
const operation: BackgroundOperation = {
	id: operationId,
	projectId,
	kind: "restore",
	scopeTargetId: requestId,
	scopeSummary: "Restore",
	triggerSummary: "Confirmed",
	triggeredByUserId: ownerId,
	status: "completed",
	attemptCount: 1,
	maxAttempts: 3,
	progressPercent: 100,
	progressStep: null,
	resultSummary: "Not a machine-readable identity",
	failureSummary: null,
	createdAt: now,
	updatedAt: now,
	startedAt: now,
	finishedAt: now,
	cancelRequestedAt: null,
};

test("only the exact authorized managed request or corresponding portable restore resolves", async () => {
	const importedId = await idempotentRecordId(
		{
			kind: "project-archive-restore",
			projectId,
			targetId: archiveId,
			userId: ownerId,
		},
		key
	);
	const restored: ProjectArchiveRestore = {
		id: importedId,
		archiveId,
		sourceProjectId: projectId,
		restoredProjectId: newProjectId,
		createdAt: now,
		manifestDigest: "a".repeat(64),
		files: [],
		ids: [],
		sections: [],
	};
	const reader = createRestoreOperationResultReader({
		managedRequests: {
			find: async () => ({
				id: requestId,
				projectId,
				archiveId,
				requestedByUserId: ownerId,
				idempotencyKey: key,
				projectName: "New",
				requestDigest: "digest",
				createdAt: new Date(),
			}),
			insert: async () => ({ status: "inserted" }),
		},
		importRequests: {
			find: async () => ({
				id: requestId,
				projectId,
				requestedByUserId: ownerId,
				idempotencyKey: key,
				projectName: "New",
				requestDigest: "digest",
				stagedObjectKey: "private",
				completedSummary: "arbitrary display copy",
				zipByteSize: 1,
				zipSha256: "a".repeat(64),
				createdAt: new Date(),
			}),
			insert: async () => ({ status: "inserted" }),
			complete: () => Promise.resolve(),
		},
		store: {
			list: async () => ({ restores: [restored] }),
			get: async (_owner, _scope, id) => (id === importedId ? restored : null),
			restore: async () => null,
		},
	});
	expect(
		await reader(
			ownerId,
			{ task: "restore", projectId, operationId, archiveId: "foreign-archive" },
			operation
		)
	).toBeNull();
	expect(
		await reader(
			ownerId,
			{ task: "upload", projectId, operationId },
			{ ...operation, kind: "archive" }
		)
	).toBeNull();
	expect(
		await reader("other", { task: "upload", projectId, operationId }, operation)
	).toBeNull();
	expect(
		await reader(ownerId, { task: "upload", projectId, operationId }, operation)
	).toEqual({ restore: restored });
	expect(
		await reader(
			ownerId,
			{ task: "upload", projectId, operationId },
			{ ...operation, status: "running" }
		)
	).toEqual({ restore: null });
});
