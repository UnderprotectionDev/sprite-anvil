import { expect, test } from "bun:test";
import { join } from "node:path";
import { serve, sleep, spawn, spawnSync } from "bun";

test("the Conductor database precheck announces its read-only work before failing", () => {
	const child = spawnSync(
		[process.execPath, "scripts/migration-runner.ts", "runtime"],
		{
			cwd: join(import.meta.dir, ".."),
			env: {
				PATH: process.env.PATH,
				NODE_ENV: "test",
				DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
				NEON_DEVELOPMENT_ENDPOINT_HOST: "ep-authorized.example.neon.tech",
				NEON_DEVELOPMENT_DATABASE_NAME: "fixture",
				NEON_LOCAL: "true",
			},
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	expect(child.exitCode).toBe(1);
	expect(child.stdout.toString()).toContain(
		"Checking development runtime compatibility (read-only); no migrations will be applied."
	);
});

test.each([
	{
		name: "an unauthorized database",
		host: "ep-authorized.example.neon.tech",
		error: "does not match its declared endpoint",
	},
	{
		name: "an unavailable authorized database",
		host: "127.0.0.1",
		error: "database connection failed",
	},
])(
	"development server refuses $name before starting HTTP",
	async (fixture) => {
		const reservation = serve({
			port: 0,
			fetch: () => new Response("reserved"),
		});
		const { port } = reservation;
		reservation.stop(true);
		if (port === undefined) {
			throw new Error("The startup fixture requires a TCP port.");
		}
		const child = spawn(
			[process.execPath, "scripts/development-runner.ts", "server"],
			{
				cwd: join(import.meta.dir, ".."),
				env: {
					PATH: process.env.PATH,
					NODE_ENV: "development",
					DEV_USE_CONDUCTOR_PORTS: "true",
					CONDUCTOR_PORT: String(port),
					DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
					NEON_DEVELOPMENT_ENDPOINT_HOST: fixture.host,
					NEON_DEVELOPMENT_DATABASE_NAME: "fixture",
					NEON_LOCAL: "true",
					BETTER_AUTH_SECRET: "development-fixture-secret-with-32-characters",
					BETTER_AUTH_URL: `http://localhost:${port}`,
					CORS_ORIGIN: `http://localhost:${port + 1}`,
				},
				stdout: "pipe",
				stderr: "pipe",
			}
		);
		const healthUrl = `http://localhost:${port}/health`;
		try {
			let response: Response | undefined;
			for (let attempt = 0; attempt < 100; attempt += 1) {
				try {
					response = await fetch(healthUrl);
					break;
				} catch {
					if (child.exitCode !== null) {
						break;
					}
					await sleep(50);
				}
			}
			expect(response).toBeUndefined();
			const [exitCode, errors, output] = await Promise.all([
				child.exited,
				new Response(child.stderr).text(),
				new Response(child.stdout).text(),
			]);
			expect(exitCode).toBe(1);
			expect(errors).toContain(fixture.error);
			expect(output).toContain(
				"Checking development runtime compatibility (read-only); no migrations will be applied."
			);
		} finally {
			child.kill("SIGTERM");
			await child.exited;
		}
		// A failed database check must never expose an apparently healthy API.
		await expect(fetch(healthUrl)).rejects.toThrow();
	},
	10_000
);
