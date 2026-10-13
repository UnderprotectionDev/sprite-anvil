import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertPublishedMigrationSources,
	findMissingMigrations,
	reconcileMigrationSources,
	refreshMigrationReferences,
	runGit,
} from "./migration-reconciliation";

test("reconciliation verifies SQL bytes, carries owning code and refuses a dirty workspace", async () => {
	const directory = mkdtempSync(join(tmpdir(), "migration-git-test-"));
	try {
		await runGit(directory, ["init", "--initial-branch=main"]);
		await runGit(directory, ["config", "user.name", "Migration fixture"]);
		await runGit(directory, ["config", "user.email", "fixture@example.test"]);
		writeFileSync(join(directory, "README.md"), "baseline\n");
		await runGit(directory, ["add", "."]);
		await runGit(directory, ["commit", "-m", "chore: baseline"]);
		const baseline = await runGit(directory, ["rev-parse", "HEAD"]);
		await runGit(directory, ["checkout", "-b", "feat/layout-source"]);
		const name = "20261011092251_layouts";
		const path = join(directory, "packages/db/src/migrations", name);
		mkdirSync(path, { recursive: true });
		mkdirSync(join(directory, "packages/db/src/schema"), { recursive: true });
		const sql = 'CREATE TABLE "layouts" ("id" text PRIMARY KEY);\n';
		writeFileSync(join(path, "migration.sql"), sql);
		writeFileSync(join(path, "snapshot.json"), "{}\n");
		writeFileSync(
			join(directory, "packages/db/src/schema/layouts.ts"),
			"export const layout = 'implementation';\n"
		);
		await runGit(directory, ["add", "."]);
		await runGit(directory, ["commit", "-m", "feat: add layouts (#118)"]);
		const commit = await runGit(directory, ["rev-parse", "HEAD"]);
		await runGit(directory, ["checkout", "-b", "fix/workspace", baseline]);
		const migration = {
			id: 1,
			name,
			createdAt: Date.UTC(2026, 9, 11, 9, 22, 51),
			hash: createHash("sha256").update(sql).digest("hex"),
		};
		// An identical SQL hash on a private branch is not provenance.
		const untrusted = await findMissingMigrations(directory, [], [migration]);
		expect(untrusted[0]?.commit).toBeUndefined();
		await runGit(directory, ["update-ref", "refs/remotes/other/main", commit]);
		expect(
			(await findMissingMigrations(directory, [], [migration]))[0]?.commit
		).toBeUndefined();
		await expect(
			reconcileMigrationSources(directory, [
				{ ...migration, commit, references: ["origin/main"] },
			])
		).rejects.toThrow("verified");
		expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(baseline);
		await runGit(directory, ["remote", "add", "origin", directory]);
		await runGit(directory, [
			"update-ref",
			"refs/remotes/origin/pull/118",
			commit,
		]);
		expect(
			(await findMissingMigrations(directory, [], [migration]))[0]?.commit
		).toBeUndefined();
		await runGit(directory, ["update-ref", "refs/pull/118/head", commit]);
		const pullSource = await findMissingMigrations(directory, [], [migration]);
		expect(pullSource[0]?.commit).toBe(commit);
		// A remote PR update invalidates a previously verified local head.
		await runGit(directory, ["update-ref", "refs/pull/118/head", baseline]);
		await expect(
			reconcileMigrationSources(directory, pullSource)
		).rejects.toThrow("verified");
		expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(baseline);
		await runGit(directory, ["update-ref", "refs/remotes/origin/main", commit]);
		const found = await findMissingMigrations(directory, [], [migration]);
		expect(found[0]?.commit).toBe(commit);
		expect(found[0]?.references).toContain("origin/main");
		expect(
			await findMissingMigrations(directory, [migration], [migration])
		).toEqual([]);
		expect(
			(
				await findMissingMigrations(
					directory,
					[],
					[{ ...migration, hash: "a".repeat(64) }]
				)
			)[0]?.commit
		).toBeUndefined();
		writeFileSync(join(directory, "README.md"), "unrelated change\n");
		await expect(reconcileMigrationSources(directory, found)).rejects.toThrow(
			"uncommitted"
		);
		expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(baseline);
		writeFileSync(join(directory, "README.md"), "baseline\n");
		await runGit(directory, ["update-ref", "-d", "refs/remotes/origin/main"]);
		await runGit(directory, ["update-ref", "refs/pull/118/head", commit]);
		await reconcileMigrationSources(directory, pullSource);
		expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(commit);
		expect(
			await runGit(directory, [
				"show",
				"HEAD:packages/db/src/schema/layouts.ts",
			])
		).toContain("implementation");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("published PR sources are discovered after refresh and private pending sources cannot be applied", async () => {
	const directory = mkdtempSync(join(tmpdir(), "migration-publication-test-"));
	const origin = join(directory, "origin");
	const workspace = join(directory, "workspace");
	mkdirSync(origin);
	try {
		await runGit(origin, ["init", "--initial-branch=main"]);
		await runGit(origin, ["config", "user.name", "Migration fixture"]);
		await runGit(origin, ["config", "user.email", "fixture@example.test"]);
		writeFileSync(join(origin, "README.md"), "baseline\n");
		await runGit(origin, ["add", "."]);
		await runGit(origin, ["commit", "-m", "chore: baseline"]);
		await runGit(directory, ["clone", origin, workspace]);
		await runGit(origin, ["checkout", "-b", "feat/source"]);
		const name = "20261013111405_layouts";
		const relative = `packages/db/src/migrations/${name}`;
		const path = join(origin, relative);
		mkdirSync(path, { recursive: true });
		mkdirSync(join(origin, "packages/db/src/schema"), { recursive: true });
		const sql = 'CREATE TABLE "layouts" ("id" text PRIMARY KEY);\n';
		writeFileSync(join(path, "migration.sql"), sql);
		writeFileSync(join(path, "snapshot.json"), "{}\n");
		writeFileSync(
			join(origin, "packages/db/src/schema/layouts.ts"),
			"export const layout = 'implementation';\n"
		);
		await runGit(origin, ["add", "."]);
		await runGit(origin, ["commit", "-m", "feat: layouts"]);
		const commit = await runGit(origin, ["rev-parse", "HEAD"]);
		const migration = {
			id: 1,
			name,
			createdAt: Date.UTC(2026, 9, 13, 11, 14, 5),
			hash: createHash("sha256").update(sql).digest("hex"),
		};
		await refreshMigrationReferences(workspace);
		// A published branch without a PR is still outside the trusted contract.
		expect(
			(await findMissingMigrations(workspace, [], [migration]))[0]?.commit
		).toBeUndefined();
		await runGit(origin, ["update-ref", "refs/pull/118/head", commit]);
		expect(
			(await findMissingMigrations(workspace, [], [migration]))[0]?.commit
		).toBeUndefined();
		await refreshMigrationReferences(workspace);
		const found = await findMissingMigrations(workspace, [], [migration]);
		expect(found[0]?.commit).toBe(commit);
		await reconcileMigrationSources(workspace, found);
		await assertPublishedMigrationSources(workspace, [migration]);
		await runGit(origin, [
			"update-ref",
			"refs/pull/118/head",
			await runGit(origin, ["rev-parse", "main"]),
		]);
		await expect(
			assertPublishedMigrationSources(workspace, [migration])
		).rejects.toThrow("published");
		await runGit(origin, ["update-ref", "refs/pull/118/head", commit]);
		writeFileSync(
			join(workspace, relative, "snapshot.json"),
			"changed snapshot\n"
		);
		await expect(
			assertPublishedMigrationSources(workspace, [migration])
		).rejects.toThrow("uncommitted");
		await runGit(workspace, ["config", "user.name", "Migration fixture"]);
		await runGit(workspace, ["config", "user.email", "fixture@example.test"]);
		await runGit(workspace, ["add", "."]);
		await runGit(workspace, ["commit", "-m", "feat: private snapshot"]);
		await expect(
			assertPublishedMigrationSources(workspace, [migration])
		).rejects.toThrow("published");
		// Even a published source with different SQL bytes cannot authorize application.
		await runGit(origin, ["fetch", workspace, "HEAD"]);
		await runGit(origin, [
			"update-ref",
			"refs/pull/118/head",
			await runGit(workspace, ["rev-parse", "HEAD"]),
		]);
		await expect(
			assertPublishedMigrationSources(workspace, [
				{ ...migration, hash: "a".repeat(64) },
			])
		).rejects.toThrow("verified");
		await runGit(origin, [
			"update-ref",
			"refs/heads/main",
			await runGit(workspace, ["rev-parse", "HEAD"]),
		]);
		await runGit(origin, ["update-ref", "-d", "refs/pull/118/head"]);
		await assertPublishedMigrationSources(workspace, [migration]);
		await expect(
			assertPublishedMigrationSources(workspace, [
				{ ...migration, hash: "bad" },
			])
		).rejects.toThrow("invalid name or hash");
		await assertPublishedMigrationSources(workspace, []);
		const preservedHead = await runGit(workspace, ["rev-parse", "HEAD"]);
		await runGit(workspace, [
			"remote",
			"set-url",
			"origin",
			join(directory, "unavailable-origin"),
		]);
		await expect(
			findMissingMigrations(workspace, [], [migration], { refresh: true })
		).rejects.toThrow("Git fetch failed");
		expect(await runGit(workspace, ["rev-parse", "HEAD"])).toBe(preservedHead);
		expect(await runGit(workspace, ["status", "--porcelain"])).toBe("");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("a published merge carries a renamed migration and its owning schema ancestry", async () => {
	const directory = mkdtempSync(join(tmpdir(), "migration-merge-test-"));
	try {
		await runGit(directory, ["init", "--initial-branch=main"]);
		await runGit(directory, ["config", "user.name", "Migration fixture"]);
		await runGit(directory, ["config", "user.email", "fixture@example.test"]);
		writeFileSync(join(directory, "README.md"), "baseline\n");
		await runGit(directory, ["add", "."]);
		await runGit(directory, ["commit", "-m", "chore: baseline"]);
		const baseline = await runGit(directory, ["rev-parse", "HEAD"]);
		await runGit(directory, ["checkout", "-b", "feat/source"]);
		const oldName = "20261013111404_layouts";
		const name = "20261013111405_layouts";
		const sql = 'CREATE TABLE "layouts" ("id" text PRIMARY KEY);\n';
		const path = join(directory, "packages/db/src/migrations", oldName);
		mkdirSync(path, { recursive: true });
		mkdirSync(join(directory, "packages/db/src/schema"), { recursive: true });
		writeFileSync(join(path, "migration.sql"), sql);
		writeFileSync(join(path, "snapshot.json"), "{}\n");
		writeFileSync(
			join(directory, "packages/db/src/schema/layouts.ts"),
			"export const layout = 'implementation';\n"
		);
		await runGit(directory, ["add", "."]);
		await runGit(directory, ["commit", "-m", "feat: layouts"]);
		await runGit(directory, ["checkout", "main"]);
		writeFileSync(join(directory, "README.md"), "parallel change\n");
		await runGit(directory, ["add", "."]);
		await runGit(directory, ["commit", "-m", "docs: parallel change"]);
		await runGit(directory, ["checkout", "feat/source"]);
		await runGit(directory, ["merge", "--no-commit", "main"]);
		await runGit(directory, [
			"mv",
			`packages/db/src/migrations/${oldName}`,
			`packages/db/src/migrations/${name}`,
		]);
		await runGit(directory, [
			"commit",
			"-m",
			"Merge and order unapplied migration",
		]);
		const commit = await runGit(directory, ["rev-parse", "HEAD"]);
		await runGit(directory, ["remote", "add", "origin", directory]);
		await runGit(directory, ["update-ref", "refs/pull/118/head", commit]);
		const migration = {
			id: 1,
			name,
			createdAt: Date.UTC(2026, 9, 13, 11, 14, 5),
			hash: createHash("sha256").update(sql).digest("hex"),
		};
		const found = await findMissingMigrations(directory, [], [migration], {
			refresh: true,
		});
		expect(found[0]?.commit).toBe(commit);
		await assertPublishedMigrationSources(directory, [migration]);
		await runGit(directory, ["checkout", "-b", "fix/consumer", baseline]);
		await reconcileMigrationSources(directory, found);
		expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(commit);
		expect(
			await runGit(directory, [
				"show",
				"HEAD:packages/db/src/schema/layouts.ts",
			])
		).toContain("implementation");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["correction", "rename", "correction and rename"])(
	"published migration %s retains owning schema ancestry",
	async (change) => {
		const directory = mkdtempSync(join(tmpdir(), "migration-lineage-test-"));
		try {
			await runGit(directory, ["init", "--initial-branch=main"]);
			await runGit(directory, ["config", "user.name", "Migration fixture"]);
			await runGit(directory, ["config", "user.email", "fixture@example.test"]);
			writeFileSync(join(directory, "README.md"), "baseline\n");
			await runGit(directory, ["add", "."]);
			await runGit(directory, ["commit", "-m", "chore: baseline"]);
			const baseline = await runGit(directory, ["rev-parse", "HEAD"]);
			const oldName = "20261013111404_layouts";
			const name = "20261013111405_layouts";
			const relative = `packages/db/src/migrations/${oldName}`;
			mkdirSync(join(directory, relative), { recursive: true });
			mkdirSync(join(directory, "packages/db/src/schema"), { recursive: true });
			writeFileSync(
				join(directory, relative, "migration.sql"),
				'CREATE TABLE "layouts" ("id" text);\n'
			);
			writeFileSync(join(directory, relative, "snapshot.json"), "{}\n");
			writeFileSync(
				join(directory, "packages/db/src/schema/layouts.ts"),
				"export const layout = 'implementation';\n"
			);
			await runGit(directory, ["add", "."]);
			await runGit(directory, ["commit", "-m", "feat: layouts"]);
			const sql =
				change === "rename"
					? 'CREATE TABLE "layouts" ("id" text);\n'
					: 'CREATE TABLE "layouts" ("id" text PRIMARY KEY);\n';
			if (change !== "rename") {
				writeFileSync(join(directory, relative, "migration.sql"), sql);
				writeFileSync(
					join(directory, relative, "snapshot.json"),
					'{"corrected":true}\n'
				);
				await runGit(directory, ["add", "."]);
				await runGit(directory, [
					"commit",
					"-m",
					"fix: correct unapplied migration",
				]);
			}
			const corrected = await runGit(directory, ["rev-parse", "HEAD"]);
			await runGit(directory, ["remote", "add", "origin", directory]);
			const migration = {
				id: 1,
				name: oldName,
				createdAt: Date.UTC(2026, 9, 13, 11, 14, 4),
				hash: createHash("sha256").update(sql).digest("hex"),
			};
			expect(
				(
					await findMissingMigrations(directory, [], [migration], {
						refresh: true,
					})
				)[0]?.commit
			).toBe(corrected);
			await assertPublishedMigrationSources(directory, [migration]);
			if (change === "correction") {
				return;
			}
			await runGit(directory, [
				"mv",
				relative,
				`packages/db/src/migrations/${name}`,
			]);
			await runGit(directory, [
				"commit",
				"-m",
				"fix: order unapplied migration",
			]);
			const renamed = await runGit(directory, ["rev-parse", "HEAD"]);
			const moved = {
				...migration,
				name,
				createdAt: Date.UTC(2026, 9, 13, 11, 14, 5),
			};
			const found = await findMissingMigrations(directory, [], [moved], {
				refresh: true,
			});
			expect(found[0]?.commit).toBe(renamed);
			await assertPublishedMigrationSources(directory, [moved]);
			// Copying SQL beside an unrelated schema ancestor is not provenance.
			const unownedName = "20261013111406_unowned";
			const unownedPath = join(
				directory,
				"packages/db/src/migrations",
				unownedName
			);
			mkdirSync(unownedPath);
			writeFileSync(join(unownedPath, "migration.sql"), sql);
			writeFileSync(join(unownedPath, "snapshot.json"), "{}\n");
			await runGit(directory, ["add", "."]);
			await runGit(directory, ["commit", "-m", "test: unowned SQL copy"]);
			const unowned = {
				...moved,
				name: unownedName,
				createdAt: Date.UTC(2026, 9, 13, 11, 14, 6),
			};
			expect(
				(
					await findMissingMigrations(directory, [], [unowned], {
						refresh: true,
					})
				)[0]?.commit
			).toBeUndefined();
			await expect(
				assertPublishedMigrationSources(directory, [unowned])
			).rejects.toThrow("verified published owning");
			await runGit(directory, ["checkout", "-b", "fix/consumer", baseline]);
			await reconcileMigrationSources(directory, found);
			expect(await runGit(directory, ["rev-parse", "HEAD"])).toBe(renamed);
			expect(
				await runGit(directory, [
					"show",
					`HEAD:packages/db/src/migrations/${name}/migration.sql`,
				])
			).toBe(sql.trim());
			expect(
				await runGit(directory, [
					"show",
					"HEAD:packages/db/src/schema/layouts.ts",
				])
			).toContain("implementation");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
);
