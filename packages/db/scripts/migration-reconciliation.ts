import { createHash } from "node:crypto";
import { spawn } from "bun";
import type { AppliedMigration, LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const migrationNamePattern = /^\d{14}_[a-z0-9][a-z0-9_-]*$/;
const migrationHashPattern = /^[a-f0-9]{64}$/;
const pullReferencePattern = /^refs\/remotes\/origin\/pull\/([1-9]\d*)$/;

async function trustedReferences(directory: string): Promise<string[]> {
	const references = (
		await runGit(directory, [
			"for-each-ref",
			"--format=%(refname)",
			"refs/remotes/origin/",
		])
	).split("\n");
	const trusted: string[] = references.filter(
		(ref) => ref === "refs/remotes/origin/main"
	);
	const pulls = references.filter((ref) => pullReferencePattern.test(ref));
	if (pulls.length === 0) {
		return trusted;
	}
	// Check all cached PR heads in one request to the owning remote.
	const advertised = new Map(
		(await runGit(directory, ["ls-remote", "origin", "refs/pull/*/head"]))
			.split("\n")
			.map((line) => {
				const [head, ref] = line.split("\t");
				return [ref, head];
			})
	);
	for (const ref of pulls) {
		const match = pullReferencePattern.exec(ref);
		const head = await runGit(directory, ["rev-parse", ref]);
		if (match && advertised.get(`refs/pull/${match[1]}/head`) === head) {
			trusted.push(ref);
		}
	}
	return trusted;
}

export async function runGit(
	directory: string,
	args: string[]
): Promise<string> {
	const child = spawn(["git", ...args], {
		cwd: directory,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [output, code] = await Promise.all([
		new Response(child.stdout).text(),
		child.exited,
		new Response(child.stderr).text(),
	]);
	if (code !== 0) {
		throw new MigrationSafetyError(
			`Git ${args[0]} failed. Inspect the repository state; no database records were changed.`
		);
	}
	return output.trim();
}

export interface MissingMigration {
	commit?: string;
	hash: string;
	name: string;
	references?: string[];
	subject?: string;
}

async function migrationCandidates(
	directory: string,
	trusted: string[],
	path: string
): Promise<string[]> {
	if (!trusted.length) {
		return [];
	}
	return (
		await runGit(directory, [
			"log",
			...trusted,
			"--diff-filter=A",
			"--format=%H",
			"--",
			`${path}/migration.sql`,
		])
	)
		.split("\n")
		.filter(Boolean);
}

export async function findMissingMigrations(
	directory: string,
	local: LocalMigration[],
	applied: AppliedMigration[]
): Promise<MissingMigration[]> {
	const absent = applied.filter(
		(row) =>
			!local.some(
				(migration) =>
					migration.name === row.name &&
					migration.hash === row.hash &&
					migration.createdAt === row.createdAt
			)
	);
	if (absent.length === 0) {
		return [];
	}
	const result: MissingMigration[] = [];
	const trusted = await trustedReferences(directory);
	for (const row of absent) {
		assertSearchableMigration(row);
		const entry: MissingMigration = { name: row.name ?? "", hash: row.hash };
		const path = `packages/db/src/migrations/${row.name}`;
		const candidates = await migrationCandidates(directory, trusted, path);
		for (const commit of candidates) {
			const subject = await runGit(directory, [
				"show",
				"-s",
				"--format=%s",
				commit,
			]);
			if (subject.startsWith("checkpoint:")) {
				continue;
			}
			// Preserve exact file bytes; runGit trims human-readable output only.
			const process = spawn(
				["git", "show", `${commit}:${path}/migration.sql`],
				{ cwd: directory, stdout: "pipe", stderr: "pipe" }
			);
			const [bytes, exitCode] = await Promise.all([
				new Response(process.stdout).arrayBuffer(),
				process.exited,
				new Response(process.stderr).text(),
			]);
			if (
				exitCode !== 0 ||
				createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !==
					row.hash
			) {
				continue;
			}
			try {
				await runGit(directory, [
					"cat-file",
					"-e",
					`${commit}:${path}/snapshot.json`,
				]);
			} catch {
				continue;
			}
			const files = (
				await runGit(directory, ["show", "--format=", "--name-only", commit])
			).split("\n");
			if (!files.some((file) => file.startsWith("packages/db/src/schema/"))) {
				continue;
			}
			entry.commit = commit;
			entry.subject = subject;
			entry.references = (
				await runGit(directory, [
					"for-each-ref",
					`--contains=${commit}`,
					"--format=%(refname:short)",
					...trusted,
				])
			)
				.split("\n")
				.filter(Boolean);
			break;
		}
		result.push(entry);
	}
	return result;
}

export async function reconcileMigrationSources(
	directory: string,
	missing: MissingMigration[]
): Promise<void> {
	if (missing.some((entry) => !entry.commit)) {
		throw new MigrationSafetyError(
			"A migration's owning Git source could not be verified. Preserve applied history; publish/fetch the owning code, schema, SQL and snapshot before retrying db:sync."
		);
	}
	const verified = await findMissingMigrations(
		directory,
		[],
		missing.map((entry, index) => ({
			id: index + 1,
			name: entry.name,
			hash: entry.hash,
			createdAt: 0,
		}))
	);
	if (
		verified.some(
			(entry, index) => !entry.commit || entry.commit !== missing[index]?.commit
		)
	) {
		throw new MigrationSafetyError(
			"A migration's owning Git source could not be verified against origin/main or an origin pull request. No merge was attempted."
		);
	}
	if ((await runGit(directory, ["status", "--porcelain"])).length > 0) {
		throw new MigrationSafetyError(
			"The workspace has uncommitted changes. Commit or preserve them before db:sync; no merge was attempted."
		);
	}
	for (const commit of new Set(
		missing
			.map((entry) => entry.commit)
			.filter((value): value is string => Boolean(value))
	)) {
		await runGit(directory, ["merge", "--no-edit", commit]);
	}
}

function assertSearchableMigration(row: AppliedMigration): void {
	if (
		!(
			row.name &&
			migrationNamePattern.test(row.name) &&
			migrationHashPattern.test(row.hash)
		)
	) {
		throw new MigrationSafetyError(
			"Shared migration has an invalid name or hash; preserve the database and inspect it securely."
		);
	}
}
