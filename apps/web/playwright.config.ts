import { defineConfig, devices } from "@playwright/test";

const contextTestDatabaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const apiPort = Number(process.env.DIRECTIONAL_E2E_API_PORT ?? 3000);
const webPort = Number(process.env.DIRECTIONAL_E2E_WEB_PORT ?? 3001);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const assetVersionStorageEnv: Record<string, string> = {};
const contextTestR2Bucket = process.env.CONTEXT_TEST_R2_BUCKET;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
if (
	process.env.ASSET_RECORDS_E2E_VERSION_STORAGE === "1" &&
	contextTestR2Bucket &&
	cloudflareAccountId &&
	r2AccessKeyId &&
	r2SecretAccessKey
) {
	Object.assign(assetVersionStorageEnv, {
		CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
		R2_ACCESS_KEY_ID: r2AccessKeyId,
		R2_SECRET_ACCESS_KEY: r2SecretAccessKey,
		R2_BUCKET: contextTestR2Bucket,
	});
}
const webServer: Array<{
	command: string;
	env: Record<string, string>;
	reuseExistingServer: boolean;
	url: string;
}> = [];

if (contextTestDatabaseUrl) {
	webServer.push({
		command: "bun run --cwd ../server e2e:directional:server",
		url: `${apiUrl}/health`,
		reuseExistingServer: false,
		env: {
			...assetVersionStorageEnv,
			DATABASE_URL: contextTestDatabaseUrl,
			BETTER_AUTH_SECRET: "project-context-e2e-secret-at-least-32-characters",
			BETTER_AUTH_URL: apiUrl,
			CORS_ORIGIN: webUrl,
			PORT: String(apiPort),
			NODE_ENV: "test",
			CONTEXT_TEST_R2_MODE: "memory",
		},
	});
}

webServer.push({
	command: `bun x vite --host 127.0.0.1 --port ${webPort}`,
	url: webUrl,
	reuseExistingServer: !(
		process.env.CI || process.env.DIRECTIONAL_E2E_API_PORT
	),
	env: { VITE_SERVER_URL: apiUrl, WEB_PORT: String(webPort) },
});

export default defineConfig({
	testDir: "./e2e",
	use: { baseURL: webUrl, ...devices["Desktop Chrome"] },
	webServer,
});
