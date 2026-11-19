import { expect, test } from "bun:test";
import { compareCodeUnits } from "@sprite-anvil/api/compare-code-units";
import type { Database } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { backgroundOperations } from "@sprite-anvil/db/schema/background-operations";
import {
	managedObjectOwnerGates,
	managedObjectReservations,
} from "@sprite-anvil/db/schema/managed-object-reservations";
import { project } from "@sprite-anvil/db/schema/project";
import { projectArchiveImportRequests } from "@sprite-anvil/db/schema/project-archives";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { eq, inArray } from "drizzle-orm";
import { createDatabaseManagedObjectCleanupCandidates } from "./database-managed-object-cleanup";
import { createDatabaseManagedObjectReservations } from "./database-managed-object-reservations";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"serializes private object writers with erasure without blocking another owner",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required.");
		}
		const first = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const second = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const writer = createDatabaseManagedObjectReservations(first);
		const eraser = createDatabaseManagedObjectReservations(second);
		const ownerId = crypto.randomUUID();
		const otherOwnerId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const otherProjectId = crypto.randomUUID();
		const owners = [ownerId, otherOwnerId];
		const projects = [projectId, otherProjectId];
		try {
			await first.insert(user).values(
				owners.map((id) => ({
					id,
					name: "Reservation regression",
					email: `${id}@example.test`,
				}))
			);
			await first.insert(project).values([
				{ id: projectId, ownerUserId: ownerId, name: "Reservation regression" },
				{
					id: otherProjectId,
					ownerUserId: otherOwnerId,
					name: "Reservation regression",
				},
			]);
			const reservation = {
				objectKey: `test/${crypto.randomUUID()}`,
				ownerUserId: ownerId,
				projectId,
				operationId: crypto.randomUUID(),
				purpose: "archive_import_zip" as const,
			};
			await writer.reserve(reservation);
			expect(await eraser.beginErasure(ownerId, "erase")).toBe(false);
			await writer.markSettled(reservation.objectKey);
			await writer.release(reservation.objectKey);
			expect(await eraser.beginErasure(ownerId, "erase")).toBe(true);
			await expect(writer.reserve(reservation)).rejects.toThrow(
				"erasure is active"
			);
			const independent = {
				...reservation,
				objectKey: `test/${crypto.randomUUID()}`,
				ownerUserId: otherOwnerId,
				projectId: otherProjectId,
			};
			await writer.reserve(independent);
			expect(await writer.listOwner(otherOwnerId)).toEqual([
				{ ...independent, writeSettled: false },
			]);
			await writer.markSettled(independent.objectKey);
			await writer.release(independent.objectKey);
			await eraser.endErasure(ownerId, "different-operation");
			await expect(writer.reserve(reservation)).rejects.toThrow(
				"erasure is active"
			);
			await eraser.endErasure(ownerId, "erase");
			await writer.reserve(reservation);
			await writer.markSettled(reservation.objectKey);
			await writer.release(reservation.objectKey);

			for (let attempt = 0; attempt < 6; attempt += 1) {
				// biome-ignore lint/performance/noAwaitInLoops: Each race must settle before the next owner gate transition.
				await raceOnce(first, writer, eraser, reservation);
			}
		} finally {
			await first
				.delete(managedObjectReservations)
				.where(inArray(managedObjectReservations.ownerUserId, owners));
			await first
				.delete(managedObjectOwnerGates)
				.where(inArray(managedObjectOwnerGates.ownerUserId, owners));
			await first.delete(project).where(inArray(project.id, projects));
			await first.delete(user).where(inArray(user.id, owners));
			await Promise.all([first.close(), second.close()]);
		}
	}
);

async function raceOnce(
	db: ReturnType<typeof createLocalTestDb>,
	writer: ReturnType<typeof createDatabaseManagedObjectReservations>,
	eraser: ReturnType<typeof createDatabaseManagedObjectReservations>,
	reservation: Parameters<typeof writer.reserve>[0]
) {
	const operationId = crypto.randomUUID();
	const candidate = {
		...reservation,
		objectKey: `test/${crypto.randomUUID()}`,
		operationId,
	};
	// Separate clients exercise overlapping SERIALIZABLE transactions.
	const outcomes = await Promise.allSettled([
		writer.reserve(candidate),
		eraser.beginErasure(reservation.ownerUserId, operationId),
	]);
	expect(outcomes.some((result) => result.status === "fulfilled")).toBe(true);
	const [gate] = await db
		.select()
		.from(managedObjectOwnerGates)
		.where(eq(managedObjectOwnerGates.ownerUserId, reservation.ownerUserId));
	const remaining = await writer.listOwner(reservation.ownerUserId);
	expect(Boolean(gate?.erasureOperationId) && remaining.length > 0).toBe(false);
	if (remaining.some((entry) => entry.objectKey === candidate.objectKey)) {
		await writer.markSettled(candidate.objectKey);
		await writer.release(candidate.objectKey);
	}
	await eraser.endErasure(reservation.ownerUserId, operationId);
}

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"cleanup reclaims only settled terminal imports with matching ownership",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required.");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const ownerId = crypto.randomUUID();
		const otherOwnerId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const scenarios: {
			id: string;
			purpose:
				| "archive_import_zip"
				| "archive_import_file"
				| "archive_restore_copy";
			status: "completed" | "failed" | "cancelled" | "running";
			settled: boolean;
			foreign?: boolean;
		}[] = [
			{
				id: "completed",
				purpose: "archive_import_zip",
				status: "completed",
				settled: true,
			},
			{
				id: "failed",
				purpose: "archive_import_file",
				status: "failed",
				settled: true,
			},
			{
				id: "cancelled",
				purpose: "archive_import_zip",
				status: "cancelled",
				settled: true,
			},
			{
				id: "uncertain",
				purpose: "archive_import_zip",
				status: "completed",
				settled: false,
			},
			{
				id: "running",
				purpose: "archive_import_file",
				status: "running",
				settled: true,
			},
			{
				id: "restore",
				purpose: "archive_restore_copy",
				status: "completed",
				settled: true,
			},
			{
				id: "foreign",
				purpose: "archive_import_zip",
				status: "completed",
				settled: true,
				foreign: true,
			},
		];
		const cases = scenarios.map((item) => ({
			...item,
			id: `${item.id}-${crypto.randomUUID()}`,
		}));
		const rollback = new Error("deliberate rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values(
						[ownerId, otherOwnerId].map((id) => ({
							id,
							name: "Cleanup regression",
							email: `${id}@example.test`,
						}))
					);
					await tx.insert(project).values({
						id: projectId,
						ownerUserId: ownerId,
						name: "Cleanup regression",
					});
					await tx
						.insert(managedObjectOwnerGates)
						.values(
							[ownerId, otherOwnerId].map((ownerUserId) => ({ ownerUserId }))
						);
					await tx.insert(projectArchiveImportRequests).values(
						cases.map((item) => ({
							id: item.id,
							projectId,
							requestedByUserId: ownerId,
							idempotencyKey: item.id,
							requestDigest: "request",
							projectName: "Restored",
							stagedObjectKey: `test/${item.id}`,
							zipByteSize: 1,
							zipSha256: "a".repeat(64),
						}))
					);
					await tx.insert(backgroundOperations).values(
						cases.map((item) => ({
							id: crypto.randomUUID(),
							projectId,
							kind: "restore" as const,
							scopeTargetId: item.id,
							scopeSummary: "Cleanup regression",
							triggerSummary: "Cleanup regression",
							triggeredByUserId: ownerId,
							status: item.status,
						}))
					);
					await tx.insert(managedObjectReservations).values(
						cases.map((item) => ({
							objectKey: `test/${item.id}`,
							ownerUserId: item.foreign ? otherOwnerId : ownerId,
							projectId,
							operationId: item.id,
							purpose: item.purpose,
							writeSettledAt: item.settled ? new Date() : null,
						}))
					);
					const keys = await createDatabaseManagedObjectCleanupCandidates(
						tx as unknown as Database
					)();
					expect(keys.sort(compareCodeUnits)).toEqual(
						cases
							.slice(0, 3)
							.map((item) => `test/${item.id}`)
							.sort(compareCodeUnits)
					);
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);
