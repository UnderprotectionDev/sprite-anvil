import { expect, test } from "bun:test";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, TOML } from "bun";
import { z } from "zod";

function runCommand() {
	return z
		.object({
			scripts: z.object({
				run: z.object({ dev: z.object({ command: z.string() }) }),
			}),
		})
		.parse(
			TOML.parse(
				readFileSync(
					join(import.meta.dir, "../../../.conductor/settings.toml"),
					"utf8"
				)
			)
		).scripts.run.dev.command;
}

const scenarios = {
	switch: ["run db:runtime:unset", "switch:--stop-only", "run dev:false"],
	"database-failure": ["run db:runtime:unset"],
	"switch-failure": ["run db:runtime:unset", "switch:--stop-only"],
	"no-helper": ["run db:runtime:unset", "run dev:false"],
};

for (const [scenario, expectedCalls] of Object.entries(scenarios)) {
	test.skipIf(process.platform !== "darwin")(
		`Conductor Run coordinates local dev switching: ${scenario}`,
		async () => {
			const root = mkdtempSync(join(tmpdir(), "conductor-run-"));
			try {
				mkdirSync(join(root, "packages/db/scripts"), { recursive: true });
				writeFileSync(
					join(root, "packages/db/scripts/development-runner.ts"),
					""
				);
				mkdirSync(join(root, "bin"));
				const log = join(root, "calls");
				const bun = join(root, "bin/bun");
				writeFileSync(
					bun,
					`#!/bin/zsh\nprint -r -- "$*:\${DEV_USE_CONDUCTOR_PORTS:-unset}" >> "$CALL_LOG"\nif [[ "$*" == "run db:runtime" ]]; then exit "$DB_STATUS"; fi\n`
				);
				chmodSync(bun, 0o755);
				if (scenario !== "no-helper") {
					mkdirSync(join(root, ".conductor/scripts"), { recursive: true });
					writeFileSync(
						join(root, ".conductor/scripts/switch-local-dev.zsh"),
						'print -r -- "switch:$*" >> "$CALL_LOG"\nexit "$SWITCH_STATUS"\n'
					);
				}
				const child = spawn(["/bin/zsh", "-c", runCommand()], {
					cwd: root,
					env: {
						...process.env,
						HOME: root,
						DEV_USE_CONDUCTOR_PORTS: undefined,
						PATH: `${join(root, "bin")}:${process.env.PATH}`,
						CALL_LOG: log,
						DB_STATUS: scenario === "database-failure" ? "1" : "0",
						SWITCH_STATUS: scenario === "switch-failure" ? "1" : "0",
					},
					stdout: "pipe",
					stderr: "pipe",
				});
				const status = await child.exited;
				const calls = readFileSync(log, "utf8").trim().split("\n");
				expect(calls).toEqual(expectedCalls);
				expect(status).toBe(scenario.endsWith("failure") ? 1 : 0);
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		}
	);
}

test("Conductor Run explicitly selects fixed ports even when allocated ports were previously enabled", () => {
	const settings = readFileSync(
		join(import.meta.dir, "../../../.conductor/settings.toml"),
		"utf8"
	);
	expect(settings).toContain("DEV_USE_CONDUCTOR_PORTS=false bun run dev");
	expect(settings).toContain('run_mode = "nonconcurrent"');
});

test("Conductor setup installs tools without requiring database readiness", () => {
	const settings = TOML.parse(
		readFileSync(
			join(import.meta.dir, "../../../.conductor/settings.toml"),
			"utf8"
		)
	);
	const { scripts } = z
		.object({ scripts: z.object({ setup: z.string() }) })
		.parse(settings);
	expect(scripts.setup).toContain("bun install --frozen-lockfile");
	expect(scripts.setup).toContain("e2e:install");
	expect(scripts.setup).not.toContain("db:");
});
