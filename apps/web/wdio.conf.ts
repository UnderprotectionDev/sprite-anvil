import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Options } from "@wdio/types";

let contextTestServer: ChildProcess | undefined;

async function waitForTestServer(attempt = 0): Promise<void> {
	if (!contextTestServer || contextTestServer.exitCode !== null) {
		throw new Error("The integration test server exited before startup.");
	}
	try {
		const response = await fetch("http://127.0.0.1:3000/health");
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

	contextTestServer = spawn("bun", ["run", "--cwd", "../server", "dev"], {
		cwd: process.cwd(),
		stdio: "ignore",
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			BETTER_AUTH_SECRET: "project-context-e2e-secret-at-least-32-characters",
			BETTER_AUTH_URL: "http://127.0.0.1:3000",
			CORS_ORIGIN: "http://127.0.0.1:3001",
			NODE_ENV: "test",
			CONTEXT_TEST_R2_MODE: "memory",
		},
	});
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
