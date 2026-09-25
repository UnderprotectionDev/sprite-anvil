import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const webServer: Array<{
	command: string;
	env: Record<string, string>;
	reuseExistingServer: boolean;
	url: string;
}> = [];

if (databaseUrl) {
	webServer.push({
		command: "bun run --cwd ../server dev",
		url: "http://127.0.0.1:3000/health",
		reuseExistingServer: false,
		env: {
			DATABASE_URL: databaseUrl,
			BETTER_AUTH_SECRET: "project-context-e2e-secret-at-least-32-characters",
			BETTER_AUTH_URL: "http://127.0.0.1:3000",
			CORS_ORIGIN: "http://127.0.0.1:3001",
			NODE_ENV: "test",
			CONTEXT_TEST_R2_MODE: "memory",
		},
	});
}

webServer.push({
	command: "bun x vite --host 127.0.0.1",
	url: "http://127.0.0.1:3001",
	reuseExistingServer: !process.env.CI,
	env: { VITE_SERVER_URL: "http://127.0.0.1:3000" },
});

export default defineConfig({
	testDir: "./e2e",
	use: { baseURL: "http://127.0.0.1:3001", ...devices["Desktop Chrome"] },
	webServer,
});
