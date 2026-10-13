import { join } from "node:path";
import { SQL, serve, spawn } from "bun";
import { withDisposablePostgres } from "./disposable-postgres";
import { runDrizzle } from "./drizzle-command";

await withDisposablePostgres(async ({ url }) => {
	const admin = new SQL(url);
	await admin.unsafe("CREATE DATABASE portrait_review_test");
	await admin.close();
	const target = new URL(url);
	target.pathname = "/portrait_review_test";
	await runDrizzle("migrate", target.toString());
	const child = spawn(
		[
			"bun",
			"test",
			"apps/server/src/portrait-identity-review.integration.test.ts",
		],
		{
			cwd: join(import.meta.dir, "../../.."),
			env: {
				...process.env,
				PORTRAIT_REVIEW_TEST_DATABASE_URL: target.toString(),
			},
			stdout: "inherit",
			stderr: "inherit",
		}
	);
	if ((await child.exited) !== 0) {
		throw new Error("Portrait review integration failed");
	}
	if (process.argv.includes("--e2e")) {
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
		const browser = spawn(
			["bun", "run", "test:e2e", "portrait-identity-review.spec.ts"],
			{
				cwd: join(import.meta.dir, "../../../apps/web"),
				env: {
					...process.env,
					DATABASE_URL: target.toString(),
					DATABASE_URL_UNPOOLED: target.toString(),
					CONTEXT_TEST_DATABASE_URL: target.toString(),
					DIRECTIONAL_E2E_API_PORT: apiPort,
					DIRECTIONAL_E2E_WEB_PORT: webPort,
					NODE_ENV: "test",
				},
				stdout: "inherit",
				stderr: "inherit",
			}
		);
		if ((await browser.exited) !== 0) {
			throw new Error("Portrait browser verification failed");
		}
	}
});
