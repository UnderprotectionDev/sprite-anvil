import { expect, test } from "bun:test";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { Database } from "@sprite-anvil/db";
import { createProjectArchiveRestoreOperations } from "../project-archive-restore-operations";
import type { StoredProjectArchiveRestoreRequest } from "../project-archive-restore-storage";
import { projectId, userId } from "./project-archive-fixtures";
import { restoreSetup } from "./project-archive-restore-fixtures";

function operationSetup() {
	const setup = restoreSetup();
	const requestRows = new Map<string, StoredProjectArchiveRestoreRequest>();
	const enqueued: { kind: string; scopeTargetId: string }[] = [];
	const operations = createProjectArchiveRestoreOperations({} as Database, {
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
		store: setup.projectArchiveRestoreStore,
	});
	return { ...setup, enqueued, operations, requestRows };
}

test("a restore too long for the request runs as a recorded restore operation and ends as the same project", async () => {
	const setup = operationSetup();
	const { archive } = await setup.createArchive();
	const input = {
		archiveId: archive.id,
		idempotencyKey: "restore-op",
		name: "Hero, restored",
		projectId,
	};

	const operation = (await setup.operations.request(
		userId,
		input
	)) as BackgroundOperation;
	expect(setup.enqueued).toMatchObject([{ kind: "restore" }]);
	// Nothing is restored until the executor runs.
	expect(setup.memory.projects.size).toBe(0);

	const summary = await setup.operations.execute({ operation });
	expect(summary).toContain("created");
	const second = await setup.operations.execute({ operation });
	expect(second).toContain("replayed");
	expect(setup.memory.projects.size).toBe(1);
	// The interactive and the background path with one key meet at one restore.
	const interactive = await setup.restore(input);
	expect(interactive.status).toBe("replayed");
	expect(setup.memory.projects.size).toBe(1);
});

test("the same key with another name is a conflict and records nothing new", async () => {
	const setup = operationSetup();
	const { archive } = await setup.createArchive();
	const input = {
		archiveId: archive.id,
		idempotencyKey: "restore-op",
		name: "One",
		projectId,
	};
	await setup.operations.request(userId, input);

	await expect(
		setup.operations.request(userId, { ...input, name: "Two" })
	).rejects.toMatchObject({ name: "IdempotencyConflictError" });
	expect(setup.requestRows.size).toBe(1);
});

test("an operation whose request is missing fails permanently without a project", async () => {
	const setup = operationSetup();
	await expect(
		setup.operations.execute({
			operation: { projectId, scopeTargetId: "missing" },
		})
	).rejects.toThrow("The restore request was not found.");
	expect(setup.memory.projects.size).toBe(0);
});

test("an archive that fails verification ends the operation as a failure the user can read", async () => {
	const setup = operationSetup();
	const { archive } = await setup.createArchive();
	await setup.corruptArchive(archive, (sections) => {
		(sections[0]?.records[0] as { id: string }).id = "changed";
	});
	const operation = (await setup.operations.request(userId, {
		archiveId: archive.id,
		idempotencyKey: "restore-op",
		name: "Hero",
		projectId,
	})) as BackgroundOperation;

	await expect(setup.operations.execute({ operation })).rejects.toThrow(
		"archive_invalid"
	);
	expect(setup.memory.projects.size).toBe(0);
});
