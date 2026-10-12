import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("Conductor Run explicitly selects fixed ports even when allocated ports were previously enabled", () => {
	const settings = readFileSync(
		join(import.meta.dir, "../../../.conductor/settings.toml"),
		"utf8"
	);
	expect(settings).toContain("DEV_USE_CONDUCTOR_PORTS=false bun run dev");
	expect(settings).toContain('run_mode = "nonconcurrent"');
});
