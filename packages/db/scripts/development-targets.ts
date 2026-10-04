import { z } from "zod";

import { selectVerifiedDatabaseTarget } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

type Environment = Record<string, string | undefined>;

const declarationSchema = z
	.array(
		z
			.object({
				name: z.string().regex(/^[a-z][a-z0-9-]*$/),
				connectionEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
				directConnectionEnv: z
					.string()
					.regex(/^[A-Z][A-Z0-9_]*$/)
					.optional(),
				host: z.string().min(1),
				database: z.string().min(1),
			})
			.strict()
	)
	.min(1);

export interface DevelopmentTarget {
	name: string;
	url: string;
}

export function selectDeploymentTarget(env: Environment): string {
	const target = selectVerifiedDatabaseTarget(env, "deploy");
	if (env.DB_DEVELOPMENT_TARGETS) {
		let declarations: z.infer<typeof declarationSchema>;
		try {
			declarations = declarationSchema.parse(
				JSON.parse(env.DB_DEVELOPMENT_TARGETS)
			);
		} catch (error) {
			throw new MigrationSafetyError(
				"Invalid DB_DEVELOPMENT_TARGETS; production separation cannot be verified.",
				{ cause: error }
			);
		}
		const url = new URL(target);
		if (
			declarations.some(
				(declaration) =>
					declaration.host === url.hostname &&
					declaration.database === decodeURIComponent(url.pathname.slice(1))
			)
		) {
			throw new MigrationSafetyError(
				"Production and development targets must be distinct."
			);
		}
	}
	return target;
}

export function selectDevelopmentTargets(
	env: Environment
): DevelopmentTarget[] {
	if (env.DB_MIGRATE_TARGET && env.DB_MIGRATE_TARGET !== "development") {
		throw new MigrationSafetyError(
			"Development preparation cannot select test or production."
		);
	}
	let input: unknown;
	try {
		input = env.DB_DEVELOPMENT_TARGETS
			? JSON.parse(env.DB_DEVELOPMENT_TARGETS)
			: [
					{
						name: "application",
						connectionEnv: "DATABASE_URL",
						directConnectionEnv: "DATABASE_URL_UNPOOLED",
						host: env.NEON_DEVELOPMENT_ENDPOINT_HOST,
						database: env.NEON_DEVELOPMENT_DATABASE_NAME,
					},
				];
	} catch (error) {
		throw new MigrationSafetyError(
			"DB_DEVELOPMENT_TARGETS must contain JSON target declarations, not connection URLs.",
			{ cause: error }
		);
	}
	const parsed = declarationSchema.safeParse(input);
	if (!parsed.success) {
		throw new MigrationSafetyError(
			"Declare shared development targets with DB_DEVELOPMENT_TARGETS, or NEON_DEVELOPMENT_ENDPOINT_HOST and NEON_DEVELOPMENT_DATABASE_NAME. Never infer the environment from a URL."
		);
	}
	if (parsed.data.length !== 1) {
		throw new MigrationSafetyError(
			"Development requires exactly one shared database declaration, including DATABASE_URL. Workspace-specific databases are unsupported."
		);
	}
	const names = new Set<string>();
	const identities = new Set<string>();
	let includesApplication = false;
	const targets = parsed.data.map((declaration) => {
		const connectionUrl = env[declaration.connectionEnv];
		const target = selectVerifiedDatabaseTarget(
			{
				...env,
				DB_MIGRATE_TARGET: "development",
				DATABASE_URL: connectionUrl,
				DATABASE_URL_UNPOOLED: declaration.directConnectionEnv
					? env[declaration.directConnectionEnv]
					: undefined,
				NEON_DEVELOPMENT_ENDPOINT_HOST: declaration.host,
				NEON_DEVELOPMENT_DATABASE_NAME: declaration.database,
			},
			"migrate"
		);
		const url = new URL(target);
		if (
			url.hostname !== declaration.host ||
			decodeURIComponent(url.pathname.slice(1)) !== declaration.database
		) {
			throw new MigrationSafetyError(
				`Development target ${declaration.name} does not match its declared endpoint and database.`
			);
		}
		if (
			url.hostname === env.NEON_PRODUCTION_ENDPOINT_HOST &&
			(!env.NEON_PRODUCTION_DATABASE_NAME ||
				declaration.database === env.NEON_PRODUCTION_DATABASE_NAME)
		) {
			throw new MigrationSafetyError(
				`Development target ${declaration.name} overlaps the production target.`
			);
		}
		const identity = `${url.hostname}:${url.port || "5432"}/${declaration.database}`;
		if (names.has(declaration.name) || identities.has(identity)) {
			throw new MigrationSafetyError(
				"Development target names and database identities must be unique."
			);
		}
		names.add(declaration.name);
		identities.add(identity);
		if (declaration.connectionEnv === "DATABASE_URL") {
			includesApplication = true;
		}
		return { name: declaration.name, url: target };
	});
	if (!includesApplication) {
		throw new MigrationSafetyError(
			"Development targets must include the application's DATABASE_URL."
		);
	}
	return targets;
}
