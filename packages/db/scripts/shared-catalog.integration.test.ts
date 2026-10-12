import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SQL } from "bun";
import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { withDisposablePostgres } from "./disposable-postgres";
import { loadMigrations } from "./migration-files";
import { sourceOptions } from "./migration-options";
import { verifySharedCatalog } from "./shared-catalog";

const parents = pgTable("review_parents", { id: text("id").primaryKey() });
const children = pgTable(
	"review_children",
	{
		id: text("id").primaryKey(),
		parent: text("parent").references(() => parents.id),
		count: integer("count"),
		state: text("state"),
	},
	(table) => [
		check("review_count_positive", sql`${table.count} > 0`),
		check("review_state", sql`${table.state} IN ('one', 'two')`),
	]
);
const schema = { parents, children };

for (const [name, alter] of [
	[
		"CHECK expression",
		"ALTER TABLE review_children DROP CONSTRAINT review_count_positive; ALTER TABLE review_children ADD CONSTRAINT review_count_positive CHECK (count > -1)",
	],
	[
		"FK deferrability",
		"ALTER TABLE review_children ALTER CONSTRAINT review_children_parent_review_parents_id_fkey DEFERRABLE INITIALLY DEFERRED",
	],
	[
		"CHECK inheritance",
		"ALTER TABLE review_children DROP CONSTRAINT review_count_positive; ALTER TABLE review_children ADD CONSTRAINT review_count_positive CHECK (count > 0) NO INHERIT",
	],
] as const) {
	test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
		`shared inspection rejects same-name ${name} drift after accepting canonical expressions`,
		async () => {
			const snapshot = await generateDrizzleJson(schema);
			await withDisposablePostgres(async ({ url }) => {
				const db = new SQL(url, { max: 1 });
				const connection = await db.reserve();
				const options = {
					schema,
					migrationDirectory: "/unused",
					proofPath: "/unused",
				};
				try {
					await connection.unsafe(`CREATE TABLE review_parents (id text PRIMARY KEY);
				CREATE TABLE review_children (id text PRIMARY KEY, parent text, count integer, state text,
				CONSTRAINT review_children_parent_review_parents_id_fkey FOREIGN KEY (parent) REFERENCES review_parents(id),
				CONSTRAINT review_count_positive CHECK (((count > 0))),
				CONSTRAINT review_state CHECK (state = ANY (ARRAY['one'::text, 'two'::text])));`);
					await connection`BEGIN READ ONLY`;
					expect(
						(
							await verifySharedCatalog(
								connection,
								options,
								snapshot,
								[],
								[],
								true
							)
						).length
					).toBeGreaterThan(0);
					await connection`ROLLBACK`;
					await connection.unsafe(alter);
					await connection`BEGIN READ ONLY`;
					await expect(
						verifySharedCatalog(connection, options, snapshot, [], [], true)
					).rejects.toThrow("constraint");
				} finally {
					await connection`ROLLBACK`;
					connection.release();
					await db.close();
				}
			});
		},
		30_000
	);
}

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"shared inspection accepts the repository schema before and after pending migration preparation",
	async () => {
		const snapshot = await generateDrizzleJson(sourceOptions.schema);
		const migrations = loadMigrations(sourceOptions.migrationDirectory);
		await withDisposablePostgres(async ({ url }) => {
			const db = new SQL(url, { max: 1 });
			const connection = await db.reserve();
			try {
				for (const migration of migrations.slice(0, -1)) {
					await connection.unsafe(
						readFileSync(
							join(
								sourceOptions.migrationDirectory,
								migration.name,
								"migration.sql"
							),
							"utf8"
						)
					);
				}
				const applied = migrations
					.slice(0, -1)
					.map((migration, index) => ({ ...migration, id: index + 1 }));
				await connection`BEGIN READ ONLY`;
				expect(
					(
						await verifySharedCatalog(
							connection,
							sourceOptions,
							snapshot,
							migrations,
							applied,
							false
						)
					).length
				).toBeGreaterThan(0);
				await connection`ROLLBACK`;
				const last = migrations.at(-1);
				if (!last) {
					throw new Error("Missing repository migrations");
				}
				await connection.unsafe(
					readFileSync(
						join(sourceOptions.migrationDirectory, last.name, "migration.sql"),
						"utf8"
					)
				);
				await connection`BEGIN READ ONLY`;
				expect(
					(
						await verifySharedCatalog(
							connection,
							sourceOptions,
							snapshot,
							migrations,
							[...applied, { ...last, id: migrations.length }],
							true
						)
					).length
				).toBeGreaterThan(0);
			} finally {
				await connection`ROLLBACK`;
				connection.release();
				await db.close();
			}
		});
	},
	120_000
);
