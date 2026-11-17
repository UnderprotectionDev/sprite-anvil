import type { Database } from "@sprite-anvil/db";
import {
	managedObjectOwnerGates as gates,
	managedObjectReservations as reservations,
} from "@sprite-anvil/db/schema/managed-object-reservations";
import { and, eq, isNull, notExists, or, sql } from "drizzle-orm";
import type {
	ManagedObjectErasureGate,
	ManagedObjectReservations,
} from "./managed-object-reservations";

/** The owner's gate row is written by both sides of every ownership transition. */
export function createDatabaseManagedObjectReservations(
	db: Database
): ManagedObjectReservations & ManagedObjectErasureGate {
	function ensure(ownerUserId: string) {
		return db
			.insert(gates)
			.values({ ownerUserId })
			.onConflictDoNothing()
			.toSQL();
	}
	async function serial(queries: { sql: string; params: unknown[] }[]) {
		const [a, b, c] = await db.$client.transaction(
			queries.map((query) => db.$client.query(query.sql, query.params)),
			{ isolationLevel: "Serializable", fullResults: true }
		);
		return [a?.rows ?? [], b?.rows ?? [], c?.rows ?? []];
	}
	return {
		async reserve(reservation) {
			const touch = db
				.update(gates)
				.set({ generation: sql`${gates.generation} + 1` })
				.where(
					and(
						eq(gates.ownerUserId, reservation.ownerUserId),
						isNull(gates.erasureOperationId)
					)
				)
				.returning({ owner: gates.ownerUserId })
				.toSQL();
			const insert = db
				.insert(reservations)
				.select(
					db
						.select({
							objectKey: sql<string>`${reservation.objectKey}`.as("objectKey"),
							ownerUserId: gates.ownerUserId,
							projectId: sql<string>`${reservation.projectId}`.as("projectId"),
							operationId: sql<string>`${reservation.operationId}`.as(
								"operationId"
							),
							purpose: sql<string>`${reservation.purpose}`.as("purpose"),
						})
						.from(gates)
						.where(
							and(
								eq(gates.ownerUserId, reservation.ownerUserId),
								isNull(gates.erasureOperationId)
							)
						)
				)
				.onConflictDoNothing()
				.returning({ key: reservations.objectKey })
				.toSQL();
			const [, touched, inserted] = await serial([
				ensure(reservation.ownerUserId),
				touch,
				insert,
			]);
			if (!touched?.length) {
				throw new Error("An erasure is active for this owner.");
			}
			if (!inserted?.length) {
				const [existing] = await db
					.select()
					.from(reservations)
					.where(eq(reservations.objectKey, reservation.objectKey));
				if (
					!(
						existing &&
						existing.ownerUserId === reservation.ownerUserId &&
						existing.projectId === reservation.projectId &&
						existing.operationId === reservation.operationId &&
						existing.purpose === reservation.purpose
					)
				) {
					throw new Error(
						"Managed object reservation conflicts with existing ownership."
					);
				}
			}
		},
		async markSettled(objectKey) {
			const [updated] = await db
				.update(reservations)
				.set({ writeSettledAt: new Date() })
				.where(eq(reservations.objectKey, objectKey))
				.returning({ key: reservations.objectKey });
			if (!updated) {
				throw new Error("Managed object reservation not found.");
			}
		},
		async release(objectKey) {
			const [item] = await db
				.select()
				.from(reservations)
				.where(eq(reservations.objectKey, objectKey));
			if (!item) {
				return;
			}
			if (!item.writeSettledAt) {
				throw new Error(
					"A write without a settled acknowledgement cannot be released."
				);
			}
			const touch = db
				.update(gates)
				.set({ generation: sql`${gates.generation} + 1` })
				.where(eq(gates.ownerUserId, item.ownerUserId))
				.returning({ owner: gates.ownerUserId })
				.toSQL();
			const remove = db
				.delete(reservations)
				.where(
					and(
						eq(reservations.objectKey, objectKey),
						eq(reservations.ownerUserId, item.ownerUserId)
					)
				)
				.returning({ key: reservations.objectKey })
				.toSQL();
			await serial([ensure(item.ownerUserId), touch, remove]);
		},
		async beginErasure(ownerUserId, operationId) {
			const outstanding = db
				.select({ key: reservations.objectKey })
				.from(reservations)
				.where(eq(reservations.ownerUserId, ownerUserId));
			const lock = db
				.update(gates)
				.set({
					erasureOperationId: operationId,
					generation: sql`${gates.generation} + 1`,
				})
				.where(
					and(
						eq(gates.ownerUserId, ownerUserId),
						or(
							isNull(gates.erasureOperationId),
							eq(gates.erasureOperationId, operationId)
						),
						notExists(outstanding)
					)
				)
				.returning({ owner: gates.ownerUserId })
				.toSQL();
			const [, locked] = await serial([ensure(ownerUserId), lock]);
			return Boolean(locked?.length);
		},
		async endErasure(ownerUserId, operationId) {
			await db
				.update(gates)
				.set({
					erasureOperationId: null,
					generation: sql`${gates.generation} + 1`,
				})
				.where(
					and(
						eq(gates.ownerUserId, ownerUserId),
						eq(gates.erasureOperationId, operationId)
					)
				);
		},
		async listOwner(ownerUserId) {
			const rows = await db
				.select()
				.from(reservations)
				.where(eq(reservations.ownerUserId, ownerUserId));
			return rows.map((row) => ({
				objectKey: row.objectKey,
				writeSettled: row.writeSettledAt !== null,
				ownerUserId: row.ownerUserId,
				projectId: row.projectId,
				operationId: row.operationId,
				purpose: row.purpose as
					| "archive_import_zip"
					| "archive_import_file"
					| "archive_restore_copy",
			}));
		},
	};
}
