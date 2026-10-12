import { fileURLToPath } from "node:url";
import { SQL, spawn } from "bun";
import { withDisposablePostgres } from "./disposable-postgres";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));

async function run(args: string[], env: NodeJS.ProcessEnv) {
	const child = spawn(["bun", ...args], {
		cwd: repositoryDirectory,
		env,
		stdout: "inherit",
		stderr: "inherit",
	});
	if ((await child.exited) !== 0) {
		throw new Error(`Tileset integration command failed: ${args.join(" ")}`);
	}
}

await withDisposablePostgres(async ({ url }) => {
	const admin = new SQL(url);
	try {
		await admin.unsafe("CREATE DATABASE tileset_adjacency_test");
	} finally {
		await admin.close();
	}
	const target = new URL(url);
	target.pathname = "/tileset_adjacency_test";
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		DATABASE_URL: target.toString(),
		DATABASE_URL_UNPOOLED: "",
		NEON_DEVELOPMENT_ENDPOINT_HOST: "127.0.0.1",
		NEON_DEVELOPMENT_DATABASE_NAME: "tileset_adjacency_test",
		NEON_LOCAL: "true",
		DB_PUSH_DISPOSABLE: "true",
		NODE_ENV: "test",
		TILESET_ADJACENCY_TEST_DATABASE_URL: target.toString(),
	};
	// The owned disposable cluster never inherits a managed database target.
	environment.DB_DEVELOPMENT_TARGETS = undefined;
	environment.MIGRATION_DATABASE_URL = undefined;
	await run(["run", "--cwd", "packages/db", "db:push"], environment);
	await run(
		[
			"test",
			"apps/server/src/features/tileset-texture-profile/server/tileset-adjacency-review.integration.test.ts",
		],
		environment
	);
});
