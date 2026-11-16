import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { withDisposablePostgres } from "../scripts/disposable-postgres";
import { createLocalTestDb } from "./testing";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"the local adapter keeps raw Neon queries lazy until their Serializable transaction and rolls back failures",
	async () => {
		await withDisposablePostgres(async ({ url }) => {
			const db = createLocalTestDb({ DATABASE_URL: url });
			try {
				await db.execute(
					sql`CREATE TABLE adapter_records (id integer PRIMARY KEY, value integer CHECK (value > 0))`
				);
				await expect(
					(async () => {
						await db.$client.transaction(
							[
								db.$client.query(
									"INSERT INTO adapter_records VALUES ($1, $2) RETURNING id",
									[1, 1]
								),
								db.$client.query(
									"INSERT INTO adapter_records VALUES ($1, $2) RETURNING id",
									[2, -1]
								),
							],
							{ isolationLevel: "Serializable", fullResults: true }
						);
					})()
				).rejects.toThrow();
				const rows = await db.$client.query("SELECT id FROM adapter_records");
				expect(rows).toEqual([]);
				const [result] = await db.$client.transaction(
					[
						db.$client.query(
							"INSERT INTO adapter_records VALUES ($1,$2) RETURNING id",
							[1, 1]
						),
					],
					{ isolationLevel: "Serializable", fullResults: true }
				);
				expect(result?.rows).toEqual([{ id: 1 }]);
			} finally {
				await db.close();
			}
		});
	}
);
