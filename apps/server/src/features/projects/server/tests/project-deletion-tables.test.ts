import { expect, test } from "bun:test";
import * as schema from "@sprite-anvil/db/schema/index";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { projectDeletionTables } from "../project-deletion-tables";

test("deletion inventory covers every project-scoped table in child-before-parent order", () => {
	const excluded = new Set([
		"background_operations",
		"managed_object_reservations",
		"project_deletion_jobs",
	]);
	const owned = Object.values(schema)
		.filter((value) => is(value, PgTable))
		.map((table) => getTableConfig(table))
		.filter(
			(config) =>
				config.columns.some((column) => column.name === "project_id") &&
				!excluded.has(config.name)
		);
	const index = new Map<string, number>(
		projectDeletionTables.map((name, i) => [name, i])
	);
	expect(new Set<string>(projectDeletionTables)).toEqual(
		new Set(owned.map((config) => config.name))
	);
	for (const table of owned) {
		for (const fk of table.foreignKeys) {
			const parent = getTableConfig(fk.reference().foreignTable).name;
			if (parent !== table.name && index.has(parent)) {
				expect(index.get(table.name)).toBeLessThan(index.get(parent) ?? 0);
			}
		}
	}
});
