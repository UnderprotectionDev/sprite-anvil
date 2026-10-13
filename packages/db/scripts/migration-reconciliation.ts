import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "bun";
import type { AppliedMigration, LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const migrationNamePattern = /^\d{14}_[a-z0-9][a-z0-9_-]*$/;
const migrationHashPattern = /^[a-f0-9]{64}$/;
const pullReferencePattern = /^refs\/remotes\/origin\/pull\/([1-9]\d*)$/;
const commitHashPattern = /^[a-f0-9]{40,64}$/;

export async function refreshMigrationReferences(
	directory: string
): Promise<void> {
	await runGit(directory, [
		"fetch",
		"--no-tags",
		"origin",
		"+refs/heads/main:refs/remotes/origin/main",
		"+refs/pull/*/head:refs/remotes/origin/pull/*",
	]);
}

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
			"--full-history",
			"--diff-merges=separate",
			"--no-patch",
			"--no-renames",
			"--diff-filter=AM",
			"--format=%H",
			"--",
			`${path}/migration.sql`,
		])
	)
		.split("\n")
		.filter(Boolean);
}

async function hasOwningSchemaHistory(
	directory: string,
	commit: string,
	path: string
): Promise<boolean> {
	const currentFiles = (
		await runGit(directory, [
			"show",
			"--diff-merges=separate",
			"--format=",
			"--name-only",
			commit,
		])
	).split("\n");
	if (currentFiles.some((file) => file.startsWith("packages/db/src/schema/"))) {
		return true;
	}
	// Follow this SQL file's history, including byte-preserving renames. An
	// unrelated schema commit elsewhere in the repository is not ownership.
	const history = await runGit(directory, [
		"log",
		"--follow",
		"--find-renames=100%",
		"--format=%H",
		"--name-status",
		commit,
		"--",
		`${path}/migration.sql`,
	]);
	let ancestor = "";
	for (const line of history.split("\n")) {
		if (commitHashPattern.test(line)) {
			ancestor = line;
			continue;
		}
		if (!(ancestor && line)) {
			continue;
		}
		const [status, ...paths] = line.split("\t");
		if (status?.startsWith("C")) {
			return false;
		}
		const sqlPath = paths.at(-1);
		if (!sqlPath?.endsWith("/migration.sql")) {
			continue;
		}
		const [subject = "", ...files] = (
			await runGit(directory, [
				"show",
				"--diff-merges=separate",
				"--format=%s",
				"--name-only",
				ancestor,
			])
		).split("\n");
		if (
			!subject.startsWith("checkpoint:") &&
			files.some((file) => file.startsWith("packages/db/src/schema/"))
		) {
			try {
				await runGit(directory, [
					"cat-file",
					"-e",
					`${ancestor}:${sqlPath.slice(0, -"migration.sql".length)}snapshot.json`,
				]);
				return true;
			} catch {
				// A SQL-only ancestor cannot establish the owning source.
			}
		}
		// Do not cross an unrelated earlier incarnation of a deleted/readded file.
		if (status === "A" || status === "D") {
			return false;
		}
	}
	return false;
}

export async function findMissingMigrations(
	directory: string,
	local: LocalMigration[],
	applied: AppliedMigration[],
	options: { refresh?: boolean } = {}
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
	if (options.refresh) {
		await refreshMigrationReferences(directory);
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
			if (!(await hasOwningSchemaHistory(directory, commit, path))) {
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

/** Require the exact committed source to be discoverable before shared DDL. */
export async function assertPublishedMigrationSources(
	directory: string,
	pending: LocalMigration[]
): Promise<void> {
	if (pending.length === 0) {
		return;
	}
	if ((await runGit(directory, ["status", "--porcelain"])).length > 0) {
		throw new MigrationSafetyError(
			"Pending migrations require a clean, published owning implementation. The workspace has uncommitted changes; commit and publish code, schema, SQL and snapshots through an origin PR before db:prepare."
		);
	}
	await refreshMigrationReferences(directory);
	const head = await runGit(directory, ["rev-parse", "HEAD"]);
	const trusted = await trustedReferences(directory);
	// origin/main is also checked remotely here; cached main alone cannot authorize new writes.
	const remoteMain = await runGit(directory, [
		"ls-remote",
		"origin",
		"refs/heads/main",
	]);
	const containing = (
		await runGit(directory, [
			"for-each-ref",
			`--contains=${head}`,
			"--format=%(refname)",
			...trusted,
		])
	)
		.split("\n")
		.filter(Boolean);
	const main = trusted.includes("refs/remotes/origin/main")
		? await runGit(directory, ["rev-parse", "refs/remotes/origin/main"])
		: undefined;
	const published = containing.some(
		(ref) =>
			trusted.includes(ref) &&
			(ref !== "refs/remotes/origin/main" || main === remoteMain.split("\t")[0])
	);
	if (!published) {
		throw new MigrationSafetyError(
			"The owning implementation HEAD is not published through current origin/main or a verified origin PR. Publish the reviewed code, schema, SQL and snapshots before db:prepare; no migration was applied."
		);
	}
	const sources = await findMissingMigrations(
		directory,
		[],
		pending.map((entry, index) => ({ ...entry, id: index + 1 }))
	);
	for (const entry of sources) {
		if (!entry.commit) {
			throw new MigrationSafetyError(
				`Pending migration ${entry.name} has no verified published owning schema/SQL/snapshot commit. No migration was applied.`
			);
		}
		const path = `packages/db/src/migrations/${entry.name}`;
		for (const file of ["migration.sql", "snapshot.json"]) {
			const child = spawn(["git", "show", `${head}:${path}/${file}`], {
				cwd: directory,
				stdout: "pipe",
				stderr: "pipe",
			});
			const [bytes, code] = await Promise.all([
				new Response(child.stdout).arrayBuffer(),
				child.exited,
				new Response(child.stderr).text(),
			]);
			if (
				code !== 0 ||
				!readFileSync(join(directory, path, file)).equals(Buffer.from(bytes))
			) {
				throw new MigrationSafetyError(
					`Pending migration ${entry.name} differs from its published source. Revalidate and publish before db:prepare; no migration was applied.`
				);
			}
			if (
				file === "migration.sql" &&
				createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !==
					entry.hash
			) {
				throw new MigrationSafetyError(
					`Pending migration ${entry.name} SQL hash differs from the verified plan. No migration was applied.`
				);
			}
		}
	}
	if (
		(await runGit(directory, ["rev-parse", "HEAD"])) !== head ||
		(await runGit(directory, ["status", "--porcelain"])).length > 0
	) {
		throw new MigrationSafetyError(
			"Owning source changed during publication verification. Retry db:prepare; no migration was applied."
		);
	}
}
