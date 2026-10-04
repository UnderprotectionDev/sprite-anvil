import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL, sleep } from "bun";
import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { pgTable, text } from "drizzle-orm/pg-core";

import {
	prepareTargets,
	withDevelopmentCompatibility,
	withDevelopmentReadiness,
} from "./database-preparation";
import { runReadyDevelopment } from "./development-command";
import { withDisposablePostgres } from "./disposable-postgres";
import {
	readValidatedSource,
	validateMigrationSource,
} from "./migration-source";
import { readFreshRuntimeSource } from "./runtime-source";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"preparation, readiness, history divergence and API leases use disposable PostgreSQL",
	async () => {
		const directory = mkdtempSync(
			join(tmpdir(), "sprite-anvil-preparation-test-")
		);
		const schema = {
			records: pgTable("records", { id: text().primaryKey(), label: text() }),
		};
		const firstSchema = {
			records: pgTable("records", { id: text().primaryKey() }),
		};
		const first = await generateDrizzleJson(firstSchema);
		const last = await generateDrizzleJson(schema, first.id);
		const migrationDirectory = join(directory, "migrations");
		for (const [name, sql, snapshot] of [
			[
				"20261002000001_records",
				'CREATE TABLE "records" ("id" text PRIMARY KEY);',
				first,
			],
			[
				"20261002000002_labels",
				'ALTER TABLE "records" ADD COLUMN "label" text;',
				last,
			],
		] as const) {
			const path = join(migrationDirectory, name);
			mkdirSync(path, { recursive: true });
			writeFileSync(join(path, "migration.sql"), sql);
			writeFileSync(join(path, "snapshot.json"), JSON.stringify(snapshot));
		}
		const proofPath = join(directory, "source-validation.json");
		try {
			await expect(
				readValidatedSource({ migrationDirectory, proofPath, schema })
			).rejects.toThrow("not been validated");
			const oldDirectory = join(directory, "old-migrations");
			const oldPath = join(oldDirectory, "20261002000001_records");
			mkdirSync(oldPath, { recursive: true });
			writeFileSync(
				join(oldPath, "migration.sql"),
				'CREATE TABLE "records" ("id" text PRIMARY KEY);'
			);
			writeFileSync(join(oldPath, "snapshot.json"), JSON.stringify(first));
			const olderSource = await validateMigrationSource({
				migrationDirectory: oldDirectory,
				proofPath: join(directory, "old-proof.json"),
				schema: firstSchema,
			});
			const source = await validateMigrationSource({
				migrationDirectory,
				proofPath,
				schema,
			});
			await withDisposablePostgres(async ({ url }) => {
				const target = { name: "application", url };
				const database = new SQL(url, { max: 2 });
				try {
					const marker = join(directory, "dev-started");
					const launch = {
						command: [
							"bun",
							"-e",
							`await Bun.write(${JSON.stringify(marker)}, 'started')`,
						],
						cwd: directory,
						env: process.env,
					};
					await expect(
						runReadyDevelopment(source, [target], launch)
					).rejects.toThrow("pending");
					expect(existsSync(marker)).toBe(false);
					await expect(
						withDevelopmentReadiness(source, [target], () => undefined)
					).rejects.toThrow("pending");
					expect(await prepareTargets(olderSource, [target])).toEqual([
						{ name: "application", status: "ready", applied: 1 },
					]);
					await database`INSERT INTO records (id) VALUES ('preserved')`;
					const prepared = await prepareTargets(source, [target]);
					expect(prepared).toEqual([
						{ name: "application", status: "ready", applied: 1 },
					]);
					await expect(
						withDevelopmentReadiness(olderSource, [target], () => undefined)
					).rejects.toThrow("ahead");
					const refused = await prepareTargets(olderSource, [target]);
					expect(refused[0]?.status).toBe("failed");
					await withDevelopmentCompatibility(
						olderSource,
						[target],
						async () => {
							await withDevelopmentCompatibility(
								olderSource,
								[target],
								() => undefined
							);
						}
					);
					expect(await runReadyDevelopment(olderSource, [target], launch)).toBe(
						0
					);
					expect(
						(
							await database`SELECT id, label FROM records WHERE id = 'preserved'`
						)[0]
					).toMatchObject({ id: "preserved", label: null });
					await database`UPDATE records SET label = 'before' WHERE id = 'preserved'`;
					expect(await prepareTargets(source, [target])).toEqual([
						{ name: "application", status: "ready", applied: 0 },
					]);
					expect(
						(
							await database`SELECT label FROM records WHERE id = 'preserved'`
						)[0]?.label
					).toBe("before");
					await database`ALTER TABLE records ALTER COLUMN label SET DEFAULT 'unsafe'`;
					await expect(
						withDevelopmentCompatibility(olderSource, [target], () => undefined)
					).rejects.toThrow("Unsupported");
					await database`ALTER TABLE records ALTER COLUMN label DROP DEFAULT`;
					await database`ALTER TABLE records ALTER COLUMN label SET NOT NULL`;
					await expect(
						runReadyDevelopment(olderSource, [target], launch)
					).rejects.toThrow("Unsupported");
					await database`ALTER TABLE records ALTER COLUMN label DROP NOT NULL`;
					await database`ALTER TABLE records ADD CONSTRAINT reject_old_writes CHECK (label IS NOT NULL)`;
					await expect(
						withDevelopmentCompatibility(olderSource, [target], () => undefined)
					).rejects.toThrow("Unsupported");
					await database`ALTER TABLE records DROP CONSTRAINT reject_old_writes`;
					await database`ALTER TABLE records DROP COLUMN id CASCADE`;
					await expect(
						withDevelopmentCompatibility(olderSource, [target], () => undefined)
					).rejects.toThrow("schema");
					await database`ALTER TABLE records ADD COLUMN id text`;
					await database`UPDATE records SET id = 'preserved'`;
					await database`ALTER TABLE records ADD PRIMARY KEY (id)`;
					await database`UPDATE drizzle.__drizzle_migrations SET hash = 'changed' WHERE id = 1`;
					await expect(
						withDevelopmentCompatibility(olderSource, [target], () => undefined)
					).rejects.toThrow("history differs");
					await database`UPDATE drizzle.__drizzle_migrations SET hash = ${source.migrations[0]?.hash} WHERE id = 1`;
					expect(await runReadyDevelopment(source, [target], launch)).toBe(0);
					expect(readFileSync(marker, "utf8")).toBe("started");
					const leaseMarker = join(directory, "leased-dev-started");
					const leaseFailure = runReadyDevelopment(source, [target], {
						...launch,
						command: [
							"bun",
							"-e",
							`await Bun.write(${JSON.stringify(leaseMarker)}, 'started'); await Bun.sleep(10000);`,
						],
					}).catch((error: unknown) => error);
					for (
						let attempt = 0;
						attempt < 100 && !existsSync(leaseMarker);
						attempt += 1
					) {
						await sleep(10);
					}
					expect(existsSync(leaseMarker)).toBe(true);
					const [heldLease] =
						await database`SELECT pid FROM pg_locks WHERE locktype = ${"advisory"} AND classid = 187733697 AND objid = 129934395 AND mode = ${"ShareLock"} AND granted`;
					expect(heldLease?.pid).toBeGreaterThan(0);
					await database`SELECT pg_terminate_backend(${heldLease?.pid})`;
					expect(String(await leaseFailure)).toContain("lease lost");
					const exclusive = await database.reserve();
					try {
						await exclusive`SELECT pg_advisory_lock(187733697, 129934395)`;
						await expect(
							runReadyDevelopment(source, [target], launch)
						).rejects.toThrow("preparation is running");
					} finally {
						await exclusive`SELECT pg_advisory_unlock(187733697, 129934395)`;
						exclusive.release();
					}
					const before =
						await database`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
					await withDevelopmentReadiness(source, [target], async () => {
						const busy = await prepareTargets(source, [target]);
						expect(busy[0]?.status).toBe("failed");
						expect(
							busy[0]?.status === "failed" ? busy[0].reason : ""
						).toContain("development API");
					});
					expect(
						await database`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`
					).toEqual(before);
					await database`ALTER TABLE records ADD CONSTRAINT labels_present CHECK (label IS NOT NULL) NOT VALID`;
					await expect(
						withDevelopmentReadiness(source, [target], () => undefined)
					).rejects.toThrow("schema");
					await database`ALTER TABLE records DROP CONSTRAINT labels_present`;
					await database`INSERT INTO drizzle.__drizzle_migrations (name, created_at, hash) VALUES ('20261002000003_future', 1790899203000, 'future')`;
					await expect(
						withDevelopmentReadiness(source, [target], () => undefined)
					).rejects.toThrow("ahead");
					await database`DELETE FROM drizzle.__drizzle_migrations WHERE name = '20261002000003_future'`;
					await database`ALTER TABLE records DROP COLUMN label`;
					await expect(
						withDevelopmentReadiness(source, [target], () => undefined)
					).rejects.toThrow("schema");
					await database`ALTER TABLE records ADD COLUMN label text`;
					await database`UPDATE drizzle.__drizzle_migrations SET hash = 'different' WHERE id = 1`;
					const divergent = await prepareTargets(source, [target]);
					expect(divergent[0]?.status).toBe("failed");
					expect(
						divergent[0]?.status === "failed" ? divergent[0].reason : ""
					).toContain("history differs");
					await database`CREATE DATABASE second_target`;
					const secondUrl = new URL(url);
					secondUrl.pathname = "/second_target";
					const partial = await prepareTargets(source, [
						{ name: "second", url: secondUrl.toString() },
						target,
					]);
					expect(partial.map((result) => result.status)).toEqual([
						"ready",
						"failed",
					]);
					expect(partial[0]?.status === "ready" ? partial[0].applied : -1).toBe(
						2
					);
					await expect(
						withDevelopmentReadiness(
							source,
							[{ name: "second", url: secondUrl.toString() }, target],
							() => undefined
						)
					).rejects.toThrow("history differs");
				} finally {
					await database.close();
				}
			});
			writeFileSync(
				join(migrationDirectory, "20261002000002_labels", "migration.sql"),
				'ALTER TABLE "records" ADD COLUMN "label" text;--> statement-breakpoint CREATE FUNCTION public.untracked() RETURNS int LANGUAGE sql AS \'SELECT 1\';'
			);
			await expect(
				validateMigrationSource({ migrationDirectory, proofPath, schema })
			).rejects.toThrow("schema");
			writeFileSync(
				join(migrationDirectory, "20261002000002_labels", "migration.sql"),
				'ALTER TABLE "records" ADD COLUMN "other" text;'
			);
			await expect(
				readValidatedSource({ migrationDirectory, proofPath, schema })
			).rejects.toThrow("stale");
			const changed = await prepareTargets(source, [
				{
					name: "never-connected",
					url: "postgresql://owner@127.0.0.1:1/unused",
				},
			]);
			expect(
				changed[0]?.status === "failed" ? changed[0].reason : ""
			).toContain("source changed");
			await expect(
				validateMigrationSource({ migrationDirectory, proofPath, schema })
			).rejects.toThrow("schema");
			expect(readFileSync(proofPath, "utf8")).toContain("fingerprint");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	120_000
);

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"running API survives compatible edits and stops on a changed imported schema",
	async () => {
		const directory = mkdtempSync(join(import.meta.dir, "runtime-fixture-"));
		const migrationDirectory = join(directory, "migrations");
		const proofPath = join(directory, "proof.json");
		const dependency = join(directory, "dependency.ts");
		const optionsModule = join(directory, "options.ts");
		const model =
			'import { pgTable, text } from "drizzle-orm/pg-core"; export const records = pgTable("records", { id: text().primaryKey() });';
		writeFileSync(dependency, model);
		writeFileSync(
			optionsModule,
			`import * as schema from "./dependency"; export const sourceOptions = { schema, migrationDirectory: ${JSON.stringify(migrationDirectory)}, proofPath: ${JSON.stringify(proofPath)} };`
		);
		const schema = { records: pgTable("records", { id: text().primaryKey() }) };
		const snapshot = await generateDrizzleJson(schema);
		const path = join(migrationDirectory, "20261002000001_records");
		mkdirSync(path, { recursive: true });
		writeFileSync(
			join(path, "migration.sql"),
			'CREATE TABLE "records" ("id" text PRIMARY KEY);'
		);
		writeFileSync(join(path, "snapshot.json"), JSON.stringify(snapshot));
		try {
			await validateMigrationSource({ schema, migrationDirectory, proofPath });
			await withDisposablePostgres(async ({ url }) => {
				const source = await readFreshRuntimeSource(optionsModule);
				const target = { name: "application", url };
				expect((await prepareTargets(source, [target]))[0]?.status).toBe(
					"ready"
				);
				const marker = join(directory, "alive");
				let finished = false;
				let inspections = 0;
				const running = runReadyDevelopment(source, [target], {
					command: [
						process.execPath,
						"-e",
						`setInterval(() => Bun.write(${JSON.stringify(marker)}, String(Date.now())), 100);`,
					],
					cwd: directory,
					env: process.env,
					revalidateSource: async () => {
						const current = await readFreshRuntimeSource(optionsModule);
						inspections += 1;
						return current;
					},
				}).then(
					() => {
						finished = true;
						return "unexpected exit";
					},
					(error: unknown) => {
						finished = true;
						return String(error);
					}
				);
				try {
					writeFileSync(
						dependency,
						`${model}\n// Compatible implementation edit`
					);
					for (
						let attempt = 0;
						attempt < 200 && inspections < 2 && !finished;
						attempt += 1
					) {
						await sleep(25);
					}
					expect(inspections).toBeGreaterThanOrEqual(2);
					expect(finished).toBe(false);
					expect(existsSync(marker)).toBe(true);
					writeFileSync(
						dependency,
						model.replace(
							"id: text().primaryKey()",
							"id: text().primaryKey(), required: text().notNull()"
						)
					);
					expect(await running).toContain("snapshot differs");
				} finally {
					// Force this fixture's supervisor to stop even when an assertion fails.
					writeFileSync(dependency, "invalid schema source");
					await running;
				}
			});
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	30_000
);
