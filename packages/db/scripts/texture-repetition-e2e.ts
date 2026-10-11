import { fileURLToPath } from "node:url";
import { SQL, serve, spawn } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { withDisposablePostgres } from "./disposable-postgres";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));

await withDisposablePostgres(async ({ url }) => {
	const admin = new SQL(url);
	try {
		await admin.unsafe("CREATE DATABASE texture_repetition_web_test");
	} finally {
		await admin.close();
	}
	const target = new URL(url);
	target.pathname = "/texture_repetition_web_test";
	const connection = new SQL(target.toString());
	try {
		await migrate(drizzle({ client: connection }), {
			migrationsFolder: `${repositoryDirectory}/packages/db/src/migrations`,
		});
	} finally {
		await connection.close();
	}
	const api = serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response(),
	});
	const web = serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response(),
	});
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		CONTEXT_TEST_DATABASE_URL: target.toString(),
		DATABASE_URL: target.toString(),
		DIRECTIONAL_E2E_API_PORT: String(api.port),
		DIRECTIONAL_E2E_WEB_PORT: String(web.port),
		NODE_ENV: "test",
	};
	for (const name of [
		"DATABASE_URL_UNPOOLED",
		"MIGRATION_DATABASE_URL",
		"DB_PUSH_DISPOSABLE",
		"DB_DEVELOPMENT_TARGETS",
		"CONTEXT_TEST_R2_BUCKET",
		"ASSET_RECORDS_E2E_VERSION_STORAGE",
	]) {
		delete environment[name];
	}
	api.stop(true);
	web.stop(true);
	const child = spawn(
		["bun", "run", "test:e2e", "e2e/texture-repetition-reviews.spec.ts"],
		{
			cwd: `${repositoryDirectory}/apps/web`,
			env: environment,
			stdout: "inherit",
			stderr: "inherit",
		}
	);
	if ((await child.exited) !== 0) {
		throw new Error("Texture repetition browser E2E failed.");
	}
});
