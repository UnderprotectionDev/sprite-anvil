import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Options } from "@wdio/types";

let contextTestServer: ChildProcess | undefined;
const apiPort = Number(process.env.DIRECTIONAL_E2E_API_PORT ?? 3000);
const webPort = Number(process.env.DIRECTIONAL_E2E_WEB_PORT ?? 3001);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

async function waitForTestServer(attempt = 0): Promise<void> {
	if (!contextTestServer || contextTestServer.exitCode !== null) {
		throw new Error("The integration test server exited before startup.");
	}
	try {
		const response = await fetch(`${apiUrl}/health`);
		if (response.ok) {
			return;
		}
	} catch {
		// The API has not opened its health endpoint yet.
	}
	if (attempt >= 59) {
		contextTestServer.kill();
		throw new Error("The integration test server did not become healthy.");
	}
	await delay(500);
	return waitForTestServer(attempt + 1);
}

async function startTestServer() {
	const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
	if (!databaseUrl) {
		return;
	}

	contextTestServer = spawn(
		"bun",
		["run", "--cwd", "../server", "e2e:directional:server"],
		{
			cwd: process.cwd(),
			stdio: "ignore",
			env: {
				...Object.fromEntries(
					Object.entries(process.env).filter(
						([name]) =>
							![
								"CLOUDFLARE_ACCOUNT_ID",
								"R2_ACCESS_KEY_ID",
								"R2_SECRET_ACCESS_KEY",
								"R2_BUCKET",
							].includes(name)
					)
				),
				...(process.env.ASSET_RECORDS_E2E_VERSION_STORAGE === "1" &&
				process.env.CONTEXT_TEST_R2_BUCKET &&
				process.env.CLOUDFLARE_ACCOUNT_ID &&
				process.env.R2_ACCESS_KEY_ID &&
				process.env.R2_SECRET_ACCESS_KEY
					? {
							CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
							R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
							R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
							R2_BUCKET: process.env.CONTEXT_TEST_R2_BUCKET,
						}
					: {}),
				DATABASE_URL: databaseUrl,
				BETTER_AUTH_SECRET: "project-context-e2e-secret-at-least-32-characters",
				BETTER_AUTH_URL: apiUrl,
				CORS_ORIGIN: webUrl,
				PORT: String(apiPort),
				NODE_ENV: "test",
				CONTEXT_TEST_R2_MODE: "memory",
			},
		}
	);
	await waitForTestServer();
}

export const config: Options.Testrunner = {
	runner: "local",
	specs: ["./desktop-e2e/**/*.spec.ts"],
	maxInstances: 1,
	capabilities: [{ browserName: "tauri" }],
	services: [
		[
			"tauri",
			{
				appBinaryPath: "./src-tauri/target/debug/app",
				driverProvider: "embedded",
				captureBackendLogs: true,
			},
		],
	],
	reporters: ["spec"],
	framework: "mocha",
	mochaOpts: { ui: "bdd", timeout: 60_000 },
	onPrepare: startTestServer,
	onComplete: () => {
		contextTestServer?.kill();
	},
};
