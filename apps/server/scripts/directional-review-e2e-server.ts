import "varlock/auto-load";
import { serve } from "bun";

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT);
const allowedDatabases = new Set([
	"directional_web_test",
	"directional_desktop_test",
	"animation_timing_web_test",
	"animation_timing_desktop_test",
]);

if (!databaseUrl || process.env.NODE_ENV !== "test") {
	throw new Error(
		"The directional review E2E server requires a test database."
	);
}

const target = new URL(databaseUrl);
if (
	!["postgres:", "postgresql:"].includes(target.protocol) ||
	target.hostname !== "127.0.0.1" ||
	!allowedDatabases.has(decodeURIComponent(target.pathname.slice(1))) ||
	process.env.CONTEXT_TEST_R2_MODE !== "memory"
) {
	throw new Error(
		"The directional review E2E server only accepts its disposable loopback databases and in-memory asset storage."
	);
}

if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
	throw new Error(
		"The directional review E2E server requires a valid local port."
	);
}

const { ENV } = await import("../src/env.server");
if (ENV.DATABASE_URL !== databaseUrl) {
	throw new Error(
		"The resolved database must match the isolated test database."
	);
}
const { default: app } = await import("../src/index");
serve({
	hostname: "127.0.0.1",
	port,
	fetch: app.fetch,
});
