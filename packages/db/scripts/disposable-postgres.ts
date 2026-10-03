import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL, serve, sleep, spawn, which } from "bun";

import { MigrationSafetyError } from "./migration-safety-error";

export async function withDisposablePostgres<Result>(
	action: (database: { url: string; directory: string }) => Promise<Result>
): Promise<Result> {
	const binary = (name: string) =>
		process.env.DB_POSTGRES_BIN
			? join(process.env.DB_POSTGRES_BIN, name)
			: which(name);
	const initdb = binary("initdb");
	const postgres = binary("postgres");
	if (!(initdb && postgres)) {
		throw new MigrationSafetyError(
			"Source validation needs local PostgreSQL initdb/postgres. Install PostgreSQL or set DB_POSTGRES_BIN to its bin directory; no managed database is used as a scratch target."
		);
	}
	const directory = mkdtempSync(join(tmpdir(), "sprite-anvil-postgres-"));
	let server: ReturnType<typeof spawn<"ignore", "pipe", "pipe">> | undefined;
	let output: Promise<unknown> | undefined;
	try {
		const init = spawn(
			[
				initdb,
				"-D",
				join(directory, "data"),
				"-U",
				"migration_verifier",
				"-A",
				"trust",
				"--no-locale",
				"--encoding=UTF8",
			],
			{ stdout: "pipe", stderr: "pipe" }
		);
		const [, , exitCode] = await Promise.all([
			new Response(init.stdout).text(),
			new Response(init.stderr).text(),
			init.exited,
		]);
		if (exitCode !== 0) {
			throw new MigrationSafetyError(
				"Disposable PostgreSQL initialization failed. Run source validation as a non-root user with local PostgreSQL installed."
			);
		}
		const listener = serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch: () => new Response(),
		});
		const { port } = listener;
		listener.stop(true);
		server = spawn(
			[
				postgres,
				"-D",
				join(directory, "data"),
				"-h",
				"127.0.0.1",
				"-p",
				String(port),
				"-k",
				directory,
				"-c",
				"fsync=off",
			],
			{ stdin: "ignore", stdout: "pipe", stderr: "pipe" }
		);
		output = Promise.all([
			new Response(server.stdout).text(),
			new Response(server.stderr).text(),
		]);
		const url = `postgresql://migration_verifier@127.0.0.1:${port}/postgres`;
		let ready = false;
		for (let attempt = 0; attempt < 100; attempt += 1) {
			if (server.exitCode !== null) {
				break;
			}
			const database = new SQL(url, { max: 1, connectionTimeout: 1 });
			try {
				await database`SELECT 1`;
				ready = true;
				break;
			} catch {
				await sleep(50);
			} finally {
				await database.close();
			}
		}
		if (!ready) {
			throw new MigrationSafetyError(
				"Disposable PostgreSQL did not become ready; no shared database was changed."
			);
		}
		return await action({ url, directory });
	} finally {
		if (server) {
			server.kill("SIGTERM");
			await server.exited;
			await output;
		}
		rmSync(directory, { recursive: true, force: true });
	}
}
