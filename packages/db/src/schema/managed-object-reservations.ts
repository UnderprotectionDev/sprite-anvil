import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/** One serialization point per owner, shared by import writes and erasure. */
export const managedObjectOwnerGates = pgTable("managed_object_owner_gates", {
	ownerUserId: text("owner_user_id").primaryKey(),
	erasureOperationId: text("erasure_operation_id"),
	generation: integer("generation").notNull().default(0),
});

/** Durable ownership created before writing a private temporary object. */
export const managedObjectReservations = pgTable(
	"managed_object_reservations",
	{
		objectKey: text("object_key").primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => managedObjectOwnerGates.ownerUserId),
		projectId: text("project_id").notNull(),
		operationId: text("operation_id").notNull(),
		purpose: text("purpose").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		writeSettledAt: timestamp("write_settled_at"),
	},
	(table) => [
		index("managed_object_reservations_owner_idx").on(table.ownerUserId),
		check(
			"managed_object_reservations_purpose_check",
			sql`${table.purpose} in ('archive_import_zip', 'archive_import_file', 'archive_restore_copy')`
		),
	]
);
