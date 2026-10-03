import { MigrationSafetyError } from "./migration-safety-error";

export function developmentEnvironment(
	environment: Record<string, string | undefined>
): Record<string, string | undefined> {
	const launchEnvironment = Object.fromEntries(
		Object.entries(environment).filter(([name]) => name !== "__VARLOCK_ENV")
	);
	const useAllocatedPorts =
		launchEnvironment.DEV_USE_CONDUCTOR_PORTS === "true";
	const configuredPort = useAllocatedPorts
		? launchEnvironment.CONDUCTOR_PORT
		: undefined;
	if (useAllocatedPorts && !configuredPort) {
		throw new MigrationSafetyError(
			"DEV_USE_CONDUCTOR_PORTS=true requires CONDUCTOR_PORT to reserve three development ports; fixed ports would conflict with another workspace."
		);
	}
	if (!configuredPort) {
		return {
			...launchEnvironment,
			PORT: "3000",
			WEB_PORT: "3001",
			DOCS_PORT: "4000",
			BETTER_AUTH_URL: "http://localhost:3000",
			CORS_ORIGIN: "http://localhost:3001",
			VITE_SERVER_URL: "http://localhost:3000",
		};
	}
	const port = Number(configuredPort);
	if (!Number.isInteger(port) || port < 1024 || port > 65_533) {
		throw new MigrationSafetyError(
			"CONDUCTOR_PORT must reserve three valid development ports."
		);
	}
	return {
		...launchEnvironment,
		PORT: String(port),
		WEB_PORT: String(port + 1),
		DOCS_PORT: String(port + 2),
		BETTER_AUTH_URL: `http://localhost:${port}`,
		CORS_ORIGIN: `http://localhost:${port + 1}`,
		VITE_SERVER_URL: `http://localhost:${port}`,
	};
}
