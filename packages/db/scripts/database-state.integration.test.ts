import { expect, test } from "bun:test";
import { SQL } from "bun";

import { readSchemaFingerprint } from "./database-state";
import { withDisposablePostgres } from "./disposable-postgres";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"the schema fingerprint is stable and changes with catalog or migration history",
	async () => {
		await withDisposablePostgres(async ({ url }) => {
			const database = new SQL(url, { max: 1 });
			try {
				const connection = await database.reserve();
				try {
					const empty = await readSchemaFingerprint(connection);
					expect(empty.endsWith(":absent")).toBe(true);

					await connection.unsafe(
						"CREATE TABLE public.sprite (id text PRIMARY KEY); CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint, name text)"
					);
					const initial = await readSchemaFingerprint(connection);
					expect(await readSchemaFingerprint(connection)).toBe(initial);

					await connection.unsafe(
						"ALTER TABLE public.sprite ADD COLUMN label text"
					);
					const changedCatalog = await readSchemaFingerprint(connection);
					expect(changedCatalog).not.toBe(initial);

					await connection.unsafe(
						"INSERT INTO drizzle.__drizzle_migrations (hash, created_at, name) VALUES ('hash', 1, 'other_issue')"
					);
					expect(await readSchemaFingerprint(connection)).not.toBe(
						changedCatalog
					);
				} finally {
					connection.release();
				}
			} finally {
				await database.close();
			}
		});
	},
	60_000
);
