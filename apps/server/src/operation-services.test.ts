import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { createMemoryOperationStorage } from "./features/background-operations/server/tests/memory-operation-storage";
import type { StoredProjectArchiveRestoreRequest } from "./features/project-archives/server/project-archive-restore-storage";
import {
	projectId,
	userId,
} from "./features/project-archives/server/tests/project-archive-fixtures";
import { restoreSetup } from "./features/project-archives/server/tests/project-archive-restore-fixtures";
import { createManagedOperationServices } from "./operation-services";

test("restore request is delivered once through the managed lifecycle", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const rows = new Map<string, StoredProjectArchiveRestoreRequest>();
	const { storage } = createMemoryOperationStorage();
	const sent: string[] = [];
	const services = createManagedOperationServices({
		db: {} as Database,
		storage,
		transport: {
			send: (id) => {
				sent.push(id);
				return Promise.resolve();
			},
		},
		restoreOptions: {
			getProjectForUser: async () => ({ id: projectId }),
			store: setup.projectArchiveRestoreStore,
			requests: {
				find: async (_project, id) => rows.get(id) ?? null,
				insert: (row) => {
					const existing = rows.get(row.id);
					if (existing) {
						return Promise.resolve({ status: "existing" as const, existing });
					}
					rows.set(row.id, row);
					return Promise.resolve({ status: "inserted" as const });
				},
			},
		},
	});
	const input = {
		archiveId: archive.id,
		idempotencyKey: "restore-op",
		name: "Hero, restored",
		projectId,
	};
	const operation = await services.projectArchiveRestoreOperations?.request(
		userId,
		input
	);
	if (!operation) {
		throw new Error("Restore request was not created");
	}
	await services.lifecycle.publishOutbox();
	expect(sent).toEqual([operation.id]);
	await services.lifecycle.deliver(operation.id);
	await services.lifecycle.deliver(operation.id);
	expect((await storage.get(operation.id))?.status).toBe("completed");
	expect(setup.memory.projects.size).toBe(1);
	expect(
		(await services.projectArchiveRestoreOperations?.request(userId, input))?.id
	).toBe(operation.id);
});

test("archive request is delivered and read back through the managed lifecycle", async () => {
	const setup = restoreSetup();
	const rows = new Map<
		string,
		import("./features/project-archives/server/project-archive-storage").StoredProjectArchiveRequest
	>();
	const { storage } = createMemoryOperationStorage();
	const sent: string[] = [];
	const services = createManagedOperationServices({
		db: {} as Database,
		storage,
		transport: {
			send: (id) => {
				sent.push(id);
				return Promise.resolve();
			},
		},
		archiveOptions: {
			getProjectForUser: async () => ({ id: projectId }),
			store: setup.archiveStore,
			requests: {
				find: async (_project, id) => rows.get(id) ?? null,
				insert: (row) => {
					const existing = rows.get(row.id);
					if (existing) {
						return Promise.resolve({ status: "existing" as const, existing });
					}
					rows.set(row.id, row);
					return Promise.resolve({ status: "inserted" as const });
				},
			},
		},
	});
	const operation = await services.projectArchiveOperations?.request(userId, {
		projectId,
		idempotencyKey: "archive-op",
		workingFileIds: [],
	});
	if (!operation) {
		throw new Error("Archive request was not created");
	}
	await services.lifecycle.publishOutbox();
	expect(sent).toEqual([operation.id]);
	await services.lifecycle.deliver(operation.id);
	await services.lifecycle.deliver(operation.id);
	expect((await storage.get(operation.id))?.status).toBe("completed");
	expect(
		(await setup.archiveStore.list(userId, projectId))?.archives
	).toHaveLength(1);
});
