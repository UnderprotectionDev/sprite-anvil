import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL, serve, sleep, spawn } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { withDisposablePostgres } from "./disposable-postgres";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));

async function runCommand(args: string[], environment: NodeJS.ProcessEnv) {
	const child = spawn(["bun", "run", ...args], {
		cwd: `${repositoryDirectory}/apps/web`,
		env: environment,
		stdout: "inherit",
		stderr: "inherit",
	});
	if ((await child.exited) !== 0) {
		throw new Error(`Portrait review ${args[0]} failed.`);
	}
}

await withDisposablePostgres(async ({ url }) => {
	const admin = new SQL(url);
	try {
		await admin.unsafe("CREATE DATABASE portrait_review_test");
	} finally {
		await admin.close();
	}
	const target = new URL(url);
	target.pathname = "/portrait_review_test";
	const connection = new SQL(target.toString());
	try {
		await migrate(drizzle({ client: connection }), {
			migrationsFolder: `${repositoryDirectory}/packages/db/src/migrations`,
		});
	} finally {
		await connection.close();
	}
	const apiListener = serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response(),
	});
	const webListener = serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response(),
	});
	const backendPort = apiListener.port;
	const webPort = webListener.port;
	apiListener.stop(true);
	webListener.stop(true);
	if (!(backendPort && webPort)) {
		throw new Error("Portrait review test ports were not assigned.");
	}
	// WKWebView does not retain Secure cookies from a disposable HTTP API.
	// Relay only cookies issued by the real auth handler for this single native
	// fixture. Production cookie policy and server authorization stay unchanged.
	const nativeCookies = new Map<string, string>();
	const gateway = serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			// WKWebView image requests omit Origin; the single fixture account
			// also needs its issued cookie on protected image downloads.
			const origin = request.headers.get("origin");
			const native = origin === "tauri://localhost" || origin === null;
			const headers = new Headers(request.headers);
			if (native && nativeCookies.size > 0) {
				headers.set("cookie", Array.from(nativeCookies.values()).join("; "));
			}
			const upstreamUrl = new URL(request.url);
			upstreamUrl.port = String(backendPort);
			const response = await fetch(
				new Request(upstreamUrl.toString(), {
					method: request.method,
					headers,
					body: ["GET", "HEAD"].includes(request.method)
						? undefined
						: await request.arrayBuffer(),
				}),
				{ redirect: "manual" }
			);
			if (native) {
				for (const cookie of response.headers.getSetCookie()) {
					const [value] = cookie.split(";", 1);
					if (value) {
						const [name] = value.split("=", 1);
						if (name) {
							nativeCookies.set(name, value);
						}
					}
				}
			}
			return response;
		},
	});
	const apiPort = gateway.port;
	if (!apiPort) {
		throw new Error("Portrait review gateway port was not assigned.");
	}
	const directory = await mkdtemp(
		join(tmpdir(), "sprite-anvil-portrait-surfaces-")
	);
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		CONTEXT_TEST_DATABASE_URL: target.toString(),
		DATABASE_URL: target.toString(),
		DIRECTIONAL_E2E_API_PORT: String(apiPort),
		DIRECTIONAL_E2E_WEB_PORT: String(webPort),
		E2E_EXTERNAL_API_SERVER: "true",
		PORTRAIT_REVIEW_RESULT_PATH: join(directory, "web-result.json"),
		BETTER_AUTH_SECRET: "project-context-e2e-secret-at-least-32-characters",
		BETTER_AUTH_URL: `http://127.0.0.1:${apiPort}`,
		CORS_ORIGIN: `http://127.0.0.1:${webPort}`,
		VITE_SERVER_URL: `http://127.0.0.1:${apiPort}`,
		PORT: String(backendPort),
		CONTEXT_TEST_R2_MODE: "memory",
		NODE_ENV: "test",
	};
	for (const name of [
		"DATABASE_URL_UNPOOLED",
		"MIGRATION_DATABASE_URL",
		"DB_PUSH_DISPOSABLE",
		"DB_DEVELOPMENT_TARGETS",
		"CONTEXT_TEST_R2_BUCKET",
		"ASSET_RECORDS_E2E_VERSION_STORAGE",
		"CLOUDFLARE_ACCOUNT_ID",
		"R2_ACCESS_KEY_ID",
		"R2_SECRET_ACCESS_KEY",
		"R2_BUCKET",
	]) {
		delete environment[name];
	}
	const api = spawn(["bun", "scripts/directional-review-e2e-server.ts"], {
		cwd: `${repositoryDirectory}/apps/server`,
		env: environment,
		stdout: "ignore",
		stderr: "inherit",
	});
	try {
		await waitForApi(backendPort, api);
		await runCommand(
			["test:e2e", "e2e/portrait-identity-review.spec.ts"],
			environment
		);
		await runCommand(["desktop:test:build"], environment);
		await runCommand(["desktop:test:portrait-review"], environment);
		console.info(
			"Portrait review web and native desktop use the same exact versions and real persistence."
		);
	} finally {
		gateway.stop(true);
		api.kill();
		await api.exited;
		await rm(directory, { recursive: true, force: true });
	}
});

async function waitForApi(port: number, api: ReturnType<typeof spawn>) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		if (api.exitCode !== null) {
			throw new Error("Portrait review API exited before startup.");
		}
		try {
			if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
				return;
			}
		} catch {
			// The isolated API may still be starting.
		}
		await sleep(500);
	}
	throw new Error("Portrait review API did not become healthy.");
}
