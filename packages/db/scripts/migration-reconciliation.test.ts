import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findMissingMigrations,
	reconcileMigrationSources,
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
