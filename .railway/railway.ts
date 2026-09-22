import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
	const app = service("app", {
		build: "bun run build:app",
		start: "bun run --cwd apps/server start",
		healthcheck: "/health",
	});

	const worker = service("worker", {
		build: "bun run --cwd apps/server build",
		start: "bun run --cwd apps/server worker",
	});

	return project("sprite-anvil", { resources: [app, worker] });
});
