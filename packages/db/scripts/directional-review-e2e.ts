import { fileURLToPath } from "node:url";
import { SQL, serve, spawn } from "bun";
import { withDisposablePostgres } from "./disposable-postgres";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));
const webDirectory = `${repositoryDirectory}/apps/web`;
const serverDirectory = `${repositoryDirectory}/apps/server`;
const animationTimingRun = process.argv[2] === "--animation-timing";
if (process.argv[2] && !animationTimingRun) {
	throw new Error("Unknown character-animation-profile E2E mode.");
}
const reviewLabel = animationTimingRun
	? "Animation timing review"
	: "Directional review";
const databaseNames: readonly [string, string, string] = animationTimingRun
	? [
			"animation_timing_test",
			"animation_timing_web_test",
			"animation_timing_desktop_test",
		]
	: ["directional_test", "directional_web_test", "directional_desktop_test"];
const integrationTest = animationTimingRun
	? "src/animation-timing-review.integration.test.ts"
	: "src/directional-review.integration.test.ts";
const integrationDatabaseEnvironmentVariable = animationTimingRun
	? "ANIMATION_TIMING_REVIEW_TEST_DATABASE_URL"
	: "DIRECTIONAL_REVIEW_TEST_DATABASE_URL";
const webE2ESpec = animationTimingRun
	? "e2e/animation-timing-reviews.spec.ts"
	: "e2e/directional-reviews.spec.ts";
const desktopE2EScript = animationTimingRun
	? "desktop:test:animation-timing"
	: "desktop:test:directional";

function databaseUrl(baseUrl: string, databaseName: string): string {
	const url = new URL(baseUrl);
	url.pathname = `/${databaseName}`;
	if (url.hostname !== "127.0.0.1") {
		throw new Error(
			"Character animation profile E2E only permits a loopback database."
		);
	}
	return url.toString();
}

function isolatedEnvironment(): NodeJS.ProcessEnv {
	const environment = { ...process.env };
	for (const name of [
		"DATABASE_URL_UNPOOLED",
		"MIGRATION_DATABASE_URL",
		"DIRECTIONAL_REVIEW_TEST_DATABASE_URL",
		"ANIMATION_TIMING_REVIEW_TEST_DATABASE_URL",
		"CONTEXT_TEST_DATABASE_URL",
		"DB_PUSH_DISPOSABLE",
		"NEON_LOCAL",
	]) {
		delete environment[name];
	}
	return environment;
}

function findTestPorts(): { apiPort: number; webPort: number } {
	const minimumPort = 20_000;
	const maximumPort = 40_000;
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const apiPort =
			minimumPort + Math.floor(Math.random() * (maximumPort - minimumPort));
		let api: ReturnType<typeof serve> | undefined;
		let web: ReturnType<typeof serve> | undefined;
		try {
			api = serve({
				hostname: "127.0.0.1",
				port: apiPort,
				fetch: () => new Response(),
			});
			web = serve({
				hostname: "127.0.0.1",
				port: apiPort + 1,
				fetch: () => new Response(),
			});
			web.stop(true);
			api.stop(true);
			return { apiPort, webPort: apiPort + 1 };
		} catch {
			web?.stop(true);
			api?.stop(true);
		}
	}
	throw new Error("Could not reserve a free pair of local E2E ports.");
}

async function createTestDatabases(baseUrl: string): Promise<void> {
	const admin = new SQL(baseUrl);
	try {
		await admin.unsafe(`CREATE DATABASE ${databaseNames[0]}`);
	} finally {
		await admin.close();
	}

	const schemaUrl = databaseUrl(baseUrl, databaseNames[0]);
	const schemaEnvironment = {
		...isolatedEnvironment(),
		DATABASE_URL: schemaUrl,
		DB_PUSH_DISPOSABLE: "true",
		NEON_LOCAL: "true",
	};
	await runCommand(
		"Prepare disposable PostgreSQL schema",
		["run", "--cwd", "packages/db", "db:push"],
		repositoryDirectory,
		schemaEnvironment
	);

	const cloneAdmin = new SQL(baseUrl);
	try {
		await cloneAdmin.unsafe(
			`CREATE DATABASE ${databaseNames[1]} TEMPLATE ${databaseNames[0]}`
		);
		await cloneAdmin.unsafe(
			`CREATE DATABASE ${databaseNames[2]} TEMPLATE ${databaseNames[0]}`
		);
	} finally {
		await cloneAdmin.close();
	}
}

async function runCommand(
	label: string,
	args: string[],
	cwd: string,
	env: NodeJS.ProcessEnv
): Promise<void> {
	console.info(`\n▶ ${label}`);
	const child = spawn(["bun", ...args], {
		cwd,
		env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) {
		throw new Error(`${label} failed with exit code ${exitCode}.`);
	}
}

async function runCharacterAnimationProfileE2E(): Promise<void> {
	await withDisposablePostgres(async ({ url: postgresUrl }) => {
		await createTestDatabases(postgresUrl);

		const integrationEnvironment = {
			...isolatedEnvironment(),
			DATABASE_URL: databaseUrl(postgresUrl, databaseNames[0]),
			[integrationDatabaseEnvironmentVariable]: databaseUrl(
				postgresUrl,
				databaseNames[0]
			),
			NODE_ENV: "test",
		};
		await runCommand(
			`${reviewLabel} PostgreSQL integration`,
			["test", integrationTest],
			serverDirectory,
			integrationEnvironment
		);

		const { apiPort, webPort } = findTestPorts();
		const apiUrl = `http://127.0.0.1:${apiPort}`;
		const webDatabaseUrl = databaseUrl(postgresUrl, databaseNames[1]);
		const webEnvironment = {
			...isolatedEnvironment(),
			CONTEXT_TEST_DATABASE_URL: webDatabaseUrl,
			DATABASE_URL: webDatabaseUrl,
			DIRECTIONAL_E2E_API_PORT: String(apiPort),
			DIRECTIONAL_E2E_WEB_PORT: String(webPort),
			NODE_ENV: "test",
		};
		await runCommand(
			`${reviewLabel} Playwright web E2E`,
			["run", "test:e2e", webE2ESpec],
			webDirectory,
			webEnvironment
		);

		const desktopDatabaseUrl = databaseUrl(postgresUrl, databaseNames[2]);
		const desktopEnvironment = {
			...isolatedEnvironment(),
			CONTEXT_TEST_DATABASE_URL: desktopDatabaseUrl,
			DATABASE_URL: desktopDatabaseUrl,
			DIRECTIONAL_E2E_API_PORT: String(apiPort),
			DIRECTIONAL_E2E_WEB_PORT: String(webPort),
			VITE_SERVER_URL: apiUrl,
		};
		await runCommand(
			`Build ${reviewLabel.toLowerCase()} desktop E2E app`,
			["run", "desktop:test:build"],
			webDirectory,
			desktopEnvironment
		);
		await runCommand(
			`${reviewLabel} Tauri desktop E2E`,
			["run", desktopE2EScript],
			webDirectory,
			desktopEnvironment
		);
	});
}

try {
	await runCharacterAnimationProfileE2E();
	console.info(
		`\n${reviewLabel} PostgreSQL, web, and desktop E2E checks passed.`
	);
} catch (error) {
	console.error(
		error instanceof Error ? error.message : `${reviewLabel} E2E failed.`
	);
	process.exitCode = 1;
}
