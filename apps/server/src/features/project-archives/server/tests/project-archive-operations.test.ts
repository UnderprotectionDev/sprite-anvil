import { expect, test } from "bun:test";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { createProjectArchiveOperations } from "../project-archive-operations";
import type { StoredProjectArchiveRequest } from "../project-archive-storage";
import { createProjectArchiveStore } from "../project-archive-store";
import { createMemoryProjectArchiveStorage } from "./memory-project-archive-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const snapshotId = "88888888-8888-4888-8888-888888888801";

const emptySource: ProjectArchiveSource = {
	files: [
		{
			assetRecordId: null,
			assetVersionId: null,
			byteSize: 10,
			contentType: null,
			fileName: "work.aseprite",
			kind: "working_file",
			objectKey: "k",
			sha256: "c".repeat(64),
			sourceId: snapshotId,
		},
	],
	records: {
		assetFamilies: [],
		assetRecords: [],
		assetVersions: [],
		canonicalDesigns: [],
		compositeVersions: [],
		compositionMemberships: [],
		contextRevisions: [],
		referenceHistory: [],
		references: [],
		relationships: [],
		subjectIdentities: [],
		unitVersions: [],
	},
};

function setup() {
	const archives = createMemoryProjectArchiveStorage();
	const store = createProjectArchiveStore({} as Database, {
		getProjectForUser: () => Promise.resolve({ id: projectId }),
		sourceReader: { read: () => Promise.resolve(emptySource) },
		storage: archives,
	});
	const requestRows = new Map<string, StoredProjectArchiveRequest>();
	const enqueued: unknown[] = [];
	const operations = createProjectArchiveOperations({} as Database, {
		getProjectForUser: () => Promise.resolve({ id: projectId }),
		operations: {
			enqueue: (request) => {
				enqueued.push(request);
				return Promise.resolve({
					projectId: request.projectId,
					scopeTargetId: request.scopeTargetId,
				} as BackgroundOperation);
			},
		},
		permanentFailure: (message) => new Error(message),
		requests: {
			find: (_project, id) => Promise.resolve(requestRows.get(id) ?? null),
			insert: (row) => {
				const existing = requestRows.get(row.id);
				if (existing) {
					return Promise.resolve({ existing, status: "existing" as const });
				}
				requestRows.set(row.id, row);
				return Promise.resolve({ status: "inserted" as const });
			},
		},
		store,
	});
	return { archives, enqueued, operations, requestRows, store };
}

const input = {
	idempotencyKey: "key-1",
	projectId,
	workingFileIds: [snapshotId],
};

test("an archive too long for the request runs as a recorded operation and ends as the same archive", async () => {
	const { enqueued, operations, store } = setup();
	const operation = await operations.request(userId, input);
	expect(enqueued).toHaveLength(1);
	expect(operation).not.toBeNull();

	const summary = await operations.execute({
		operation: operation as BackgroundOperation,
	});
	expect(summary).toContain("created");

	const catalog = await store.list(userId, projectId);
	expect(catalog?.archives).toHaveLength(1);
	const archive = await store.get(
		userId,
		projectId,
		catalog?.archives[0]?.id ?? ""
	);
	expect(
		archive?.manifest.files.find((file) => file.sourceId === snapshotId)
	).toMatchObject({ presence: "included" });
});

test("a repeated delivery of the same operation never makes a second archive", async () => {
	const { operations, store } = setup();
	const operation = (await operations.request(
		userId,
		input
	)) as BackgroundOperation;

	await operations.execute({ operation });
	const second = await operations.execute({ operation });

	expect(second).toContain("replayed");
	expect((await store.list(userId, projectId))?.archives).toHaveLength(1);
});

test("the same key with another selection is a conflict and records nothing new", async () => {
	const { operations, requestRows } = setup();
	await operations.request(userId, input);

	await expect(
		operations.request(userId, { ...input, workingFileIds: [] })
	).rejects.toMatchObject({ name: "IdempotencyConflictError" });
	expect(requestRows.size).toBe(1);
});

test("an operation whose request is missing fails permanently without an archive", async () => {
	const { operations, store } = setup();
	await expect(
		operations.execute({ operation: { projectId, scopeTargetId: "missing" } })
	).rejects.toThrow("The archive request was not found.");
	expect((await store.list(userId, projectId))?.archives).toEqual([]);
});

test("an archive the store refuses ends the operation as a failure the user can read", async () => {
	const { operations } = setup();
	const operation = (await operations.request(userId, {
		...input,
		workingFileIds: ["88888888-8888-4888-8888-888888888899"],
	})) as BackgroundOperation;
	await expect(operations.execute({ operation })).rejects.toThrow(
		"working_file_unavailable"
	);
});
