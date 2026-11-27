import { expect, test } from "bun:test";
import { createInteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import { user } from "@sprite-anvil/db/schema/auth";
import {
	backgroundOperationOutbox,
	backgroundOperations,
} from "@sprite-anvil/db/schema/background-operations";
import { collections } from "@sprite-anvil/db/schema/collections";
import { project } from "@sprite-anvil/db/schema/project";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createDatabaseManagedObjectReservations } from "./database-managed-object-reservations";
import { createDatabaseOperationStorage } from "./features/background-operations/server/database-operation-storage";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectDeletionService } from "./features/projects/server/project-deletion-service";

const url = process.env.CONTEXT_TEST_DATABASE_URL;
test.skipIf(!isLoopbackTestDatabaseUrl(url))(
	"serializes project names and deletes an approved project without touching another project's records",
	async () => {
		if (!url) {
			throw new Error("Disposable loopback database required");
		}
		const db = createInteractiveDatabase({ DATABASE_URL: url });
		const local = createLocalTestDb({ DATABASE_URL: url });
		const second = createLocalTestDb({ DATABASE_URL: url });
		const ownerId = crypto.randomUUID();
		await db
			.insert(user)
			.values({ id: ownerId, name: "Owner", email: `${ownerId}@example.test` });
		const context = createProjectContextStore(local, db);
		const concurrent = await Promise.allSettled([
			context.createProject(ownerId, { name: "Same", generalArtDirection: "" }),
			createProjectContextStore(second, db).createProject(ownerId, {
				name: "same",
				generalArtDirection: "",
			}),
		]);
		expect(
			concurrent.filter((item) => item.status === "fulfilled")
		).toHaveLength(1);
		expect(
			concurrent.filter((item) => item.status === "rejected")
		).toHaveLength(1);
		const target = await context.createProject(
			ownerId,
			{ name: "Delete me", generalArtDirection: "" },
			`users/${ownerId}/project-look-${crypto.randomUUID()}.png`
		);
		const other = await context.createProject(ownerId, {
			name: "Keep me",
			generalArtDirection: "",
		});
		await db.insert(collections).values({
			id: crypto.randomUUID(),
			projectId: target.id,
			name: "Test collection",
			createdByUserId: ownerId,
		});
		const keys = new Set([
			`projects/${target.id}/legacy-object`,
			`projects/${other.id}/keep-object`,
		]);
		const deleted: string[] = [];

		const gate = createDatabaseManagedObjectReservations(local);
		const service = createProjectDeletionService({
			db,
			objects: {
				list: async (prefix) =>
					[...keys].filter((key) => key.startsWith(prefix)),
				delete: (key) => {
					deleted.push(key);
					keys.delete(key);
					return Promise.resolve();
				},
			},
			// Simulate an interruption before the final external gate release.
			gate: { ...gate, endErasure: async () => undefined },
			operationStorage: createDatabaseOperationStorage(local),
			permanentFailure: (message) => new Error(message),
		});
		try {
			expect(await service.prepare("other-owner", target.id)).toBeNull();
			const initial = await service.prepare(ownerId, target.id);
			expect(
				initial?.records.some(
					(record) => record.kind === "collections" && record.count === 1
				)
			).toBe(true);
			if (!initial) {
				throw new Error("Missing impact");
			}
			await expect(
				service.request(ownerId, {
					projectId: target.id,
					scopeDigest: initial.scopeDigest,
					confirmation: "wrong",
					idempotencyKey: crypto.randomUUID(),
				})
			).rejects.toThrow("exact project name");
			expect(deleted).toHaveLength(0);
			const job = await service.request(ownerId, {
				projectId: target.id,
				scopeDigest: initial.scopeDigest,
				confirmation: target.name,
				idempotencyKey: crypto.randomUUID(),
			});
			if (!job?.operation) {
				throw new Error("Missing deletion operation");
			}
			expect(
				await db
					.select()
					.from(backgroundOperationOutbox)
					.where(
						eq(
							backgroundOperationOutbox.backgroundOperationId,
							job.operation.id
						)
					)
			).toHaveLength(1);
			// Simulate a worker losing its lease after acquiring the durable gate.
			expect(await gate.beginErasure(ownerId, job.id)).toBe(true);
			await db
				.update(backgroundOperations)
				.set({ status: "failed" })
				.where(eq(backgroundOperations.id, job.operation.id));
			const retried = await service.retry(ownerId, job.id);
			if (!retried?.operation) {
				throw new Error("Missing retry operation");
			}
			expect(retried.operation.id).not.toBe(job.operation.id);
			await service.execute({
				operation: retried.operation,
				checkpoint: () => Promise.resolve(),
				reportProgress: () => Promise.resolve(),
			});
			expect(
				await db.select().from(project).where(eq(project.id, target.id))
			).toHaveLength(0);
			expect(
				await db
					.select()
					.from(collections)
					.where(eq(collections.projectId, target.id))
			).toHaveLength(0);
			expect(
				await db.select().from(project).where(eq(project.id, other.id))
			).toHaveLength(1);
			expect(keys.has(`projects/${other.id}/keep-object`)).toBe(true);
			expect((await service.read(ownerId, target.id))?.state).toBe("completed");
			expect(await service.read("other-owner", target.id)).toBeNull();
			expect(await gate.beginErasure(ownerId, "next-job")).toBe(true);
			await gate.endErasure(ownerId, "next-job");
		} finally {
			await local.close();
			await second.close();
			await db.$client.close();
		}
	},
	30_000
);
