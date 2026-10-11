import { join } from "node:path";
import { SQL, serve, spawn } from "bun";
import { withDisposablePostgres } from "./disposable-postgres";
import { runDrizzle } from "./drizzle-command";

const root = join(import.meta.dir, "../../..");
async function run(args: string[], env: NodeJS.ProcessEnv, cwd = root) {
	const child = spawn(["bun", ...args], {
		cwd,
		env,
		stdout: "inherit",
		stderr: "inherit",
	});
	if ((await child.exited) !== 0) {
		throw new Error("Background Layer Layout verification failed.");
	}
}
await withDisposablePostgres(async ({ url }) => {
	const admin = new SQL(url);
	await admin.unsafe("CREATE DATABASE background_layer_layout_test");
	await admin.close();
	const target = new URL(url);
	target.pathname = "/background_layer_layout_test";
	await runDrizzle("migrate", target.toString());
	const env = {
		...process.env,
		DATABASE_URL: target.toString(),
		DATABASE_URL_UNPOOLED: target.toString(),
		BACKGROUND_LAYER_LAYOUT_TEST_DATABASE_URL: target.toString(),
		NODE_ENV: "test",
	};
	await run(
		["test", "apps/server/src/background-layer-layout.integration.test.ts"],
		env
	);
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
	const apiPort = String(api.port);
	const webPort = String(web.port);
	api.stop(true);
	web.stop(true);
	await run(
		["run", "test:e2e", "background-layer-layout.spec.ts"],
		{
			...env,
			CONTEXT_TEST_DATABASE_URL: target.toString(),
			DIRECTIONAL_E2E_API_PORT: apiPort,
			DIRECTIONAL_E2E_WEB_PORT: webPort,
		},
		join(root, "apps/web")
	);
});
