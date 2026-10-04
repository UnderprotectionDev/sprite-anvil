import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawnSync } from "bun";

import { developmentEnvironment } from "./development-environment";

test("workspaces use allocated ports without changing credentials or fixed global processes", () => {
	const environment = developmentEnvironment({
		CONDUCTOR_PORT: "5400",
		DEV_USE_CONDUCTOR_PORTS: "true",
		DATABASE_URL: "opaque",
		BETTER_AUTH_SECRET: "secret",
	});
	expect(environment).toEqual({
		CONDUCTOR_PORT: "5400",
		DEV_USE_CONDUCTOR_PORTS: "true",
		DATABASE_URL: "opaque",
		BETTER_AUTH_SECRET: "secret",
		PORT: "5400",
		WEB_PORT: "5401",
		DOCS_PORT: "5402",
		BETTER_AUTH_URL: "http://localhost:5400",
		CORS_ORIGIN: "http://localhost:5401",
		VITE_SERVER_URL: "http://localhost:5400",
	});
	expect(() =>
		developmentEnvironment({
			CONDUCTOR_PORT: "65535",
			DEV_USE_CONDUCTOR_PORTS: "true",
		})
	).toThrow();
});

test("opting into allocated ports without CONDUCTOR_PORT fails closed", () => {
	expect(() =>
		developmentEnvironment({ DEV_USE_CONDUCTOR_PORTS: "true" })
	).toThrow("CONDUCTOR_PORT");
});

test("default development restores localhost ports despite Conductor allocation", () => {
	const environment = developmentEnvironment({
		CONDUCTOR_PORT: "55010",
		DATABASE_URL: "opaque",
		BETTER_AUTH_SECRET: "secret",
	});
	expect(environment.PORT).toBe("3000");
	expect(environment.WEB_PORT).toBe("3001");
	expect(environment.DOCS_PORT).toBe("4000");
	expect(environment.BETTER_AUTH_URL).toBe("http://localhost:3000");
	expect(environment.CORS_ORIGIN).toBe("http://localhost:3001");
	expect(environment.VITE_SERVER_URL).toBe("http://localhost:3000");
	expect(environment.DATABASE_URL).toBe("opaque");
	expect(environment.BETTER_AUTH_SECRET).toBe("secret");
});

test("server startup resolves its own Varlock schema after database readiness", () => {
	const environment = {
		...process.env,
		__VARLOCK_ENV: undefined,
		NODE_ENV: "development",
		DATABASE_URL:
			"postgresql://fixture:fixture@ep-fixture.example.neon.tech/fixture",
		BETTER_AUTH_SECRET: "development-fixture-secret-with-32-characters",
		BETTER_AUTH_URL: "http://localhost:5400",
		CORS_ORIGIN: "http://localhost:5401",
		CONDUCTOR_PORT: "5400",
	};
	const serverDirectory = join(import.meta.dir, "../../../apps/server");
	const parent = spawnSync(
		[
			"bun",
			"-e",
			`await import("varlock/auto-load");
const { developmentEnvironment } = await import(${JSON.stringify(join(import.meta.dir, "development-environment.ts"))});
const server = Bun.spawnSync(["bun", "-e", 'await import("varlock/auto-load"); console.log(Boolean(process.env.BETTER_AUTH_SECRET));'], {
 cwd: ${JSON.stringify(serverDirectory)}, env: developmentEnvironment(process.env), stdout: "pipe", stderr: "pipe"
});
console.log(server.exitCode, server.stdout.toString().trim());`,
		],
		{
			cwd: join(import.meta.dir, ".."),
			env: environment,
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	expect(parent.exitCode).toBe(0);
	expect(parent.stdout.toString().trim()).toBe("0 true");
});

test("PostgreSQL executable paths remain usable through Varlock's output guard", () => {
	const inspection = spawnSync(
		[
			process.execPath,
			"-e",
			'await import("varlock/auto-load"); const output = Bun.spawn(["printf", "%s", process.env.DB_POSTGRES_BIN], { stdout: "pipe" }); console.log(await new Response(output.stdout).text());',
		],
		{
			cwd: join(import.meta.dir, ".."),
			env: {
				PATH: process.env.PATH,
				__VARLOCK_ENV: undefined,
				NODE_ENV: "test",
				// Satisfy the imported schema without relying on local credentials.
				DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
				DB_POSTGRES_BIN: "/fixture/postgres/bin",
			},
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	expect(inspection.exitCode).toBe(0);
	expect(inspection.stdout.toString().trim()).toBe("/fixture/postgres/bin");
});
