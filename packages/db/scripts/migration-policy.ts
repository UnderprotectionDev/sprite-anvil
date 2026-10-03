import { MigrationSafetyError } from "./migration-safety-error";

export interface LocalMigration {
	createdAt: number;
	hash: string;
	name: string;
}

export interface AppliedMigration {
	createdAt: number;
	hash: string;
	id: number;
	name: string | null;
}

type TargetMode = "migrate" | "deploy" | "push";
type Environment = Record<string, string | undefined>;

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const neonEndpointPattern = /^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/;

function parsePostgresUrl(value: string | undefined): URL {
	if (!value) {
		throw new MigrationSafetyError("DATABASE_URL is required.");
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch (error) {
		throw new MigrationSafetyError("The database URL is invalid.", {
			cause: error,
		});
	}
	if (
		(url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
		!url.hostname ||
		!url.pathname ||
		url.pathname === "/"
	) {
		throw new MigrationSafetyError(
			"A PostgreSQL URL with a database name is required."
		);
	}
	return url;
}

function directNeonUrl(url: URL): URL {
	const { hostname } = url;
	if (!neonEndpointPattern.test(hostname)) {
		throw new MigrationSafetyError(
			"The database target must be a Neon endpoint."
		);
	}
	const direct = new URL(url);
	const [endpoint, ...suffix] = hostname.split(".");
	if (!endpoint) {
		throw new MigrationSafetyError("The Neon endpoint hostname is invalid.");
	}
	if (endpoint.endsWith("-pooler")) {
		if (endpoint === "ep-pooler") {
			throw new MigrationSafetyError(
				"The Neon pooler hostname cannot be converted safely."
			);
		}
		direct.hostname = [endpoint.slice(0, -"-pooler".length), ...suffix].join(
			"."
		);
	}
	return direct;
}

function selectRemoteTarget(
	env: Environment,
	applicationUrl: URL,
	mode: TargetMode
): string {
	if (mode === "deploy") {
		if (
			env.DB_MIGRATE_TARGET !== "production" ||
			env.DB_MIGRATE_DEPLOY_CONFIRM !== "production"
		) {
			throw new MigrationSafetyError(
				"Deployment requires DB_MIGRATE_TARGET=production and DB_MIGRATE_DEPLOY_CONFIRM=production."
			);
		}
	} else if (env.DB_MIGRATE_TARGET !== "development") {
		throw new MigrationSafetyError(
			"Set DB_MIGRATE_TARGET=development for migration."
		);
	}
	const derived = directNeonUrl(applicationUrl);
	if (!env.DATABASE_URL_UNPOOLED) {
		return derived.toString();
	}
	const unpooled = directNeonUrl(parsePostgresUrl(env.DATABASE_URL_UNPOOLED));
	if (
		unpooled.hostname !== derived.hostname ||
		unpooled.pathname !== derived.pathname ||
		unpooled.username !== derived.username ||
		unpooled.port !== derived.port ||
		unpooled.hostname !== new URL(env.DATABASE_URL_UNPOOLED).hostname
	) {
		throw new MigrationSafetyError(
			"DATABASE_URL_UNPOOLED must be the matching direct endpoint."
		);
	}
	return unpooled.toString();
}

export function selectDatabaseTarget(
	env: Environment,
	mode: TargetMode
): string {
	if (env.MIGRATION_DATABASE_URL) {
		throw new MigrationSafetyError(
			"MIGRATION_DATABASE_URL is not a supported target selector."
		);
	}
	const applicationUrl = parsePostgresUrl(env.DATABASE_URL);
	const isLocal = loopbackHosts.has(applicationUrl.hostname);
	if (isLocal && env.DATABASE_URL_UNPOOLED) {
		throw new MigrationSafetyError(
			"A local database target cannot use DATABASE_URL_UNPOOLED."
		);
	}
	if (env.NEON_LOCAL === "true" && !isLocal) {
		throw new MigrationSafetyError(
			"NEON_LOCAL requires a loopback PostgreSQL host."
		);
	}
	if (mode === "push") {
		if (
			!isLocal ||
			env.NEON_LOCAL !== "true" ||
			env.DB_PUSH_DISPOSABLE !== "true"
		) {
			throw new MigrationSafetyError(
				"db:push requires NEON_LOCAL=true and DB_PUSH_DISPOSABLE=true on loopback PostgreSQL."
			);
		}
		return applicationUrl.toString();
	}
	if (isLocal) {
		if (mode === "deploy" || env.NEON_LOCAL !== "true") {
			throw new MigrationSafetyError(
				"Local migration requires NEON_LOCAL=true and cannot be a deployment."
			);
		}
		if (env.DB_MIGRATE_TARGET !== "development") {
			throw new MigrationSafetyError(
				"Set DB_MIGRATE_TARGET=development for local migration."
			);
		}
		return applicationUrl.toString();
	}
	return selectRemoteTarget(env, applicationUrl, mode);
}

function expectedEndpointHost(env: Environment, mode: TargetMode): string {
	let key = "NEON_DEVELOPMENT_ENDPOINT_HOST";
	if (mode === "deploy") {
		key = "NEON_PRODUCTION_ENDPOINT_HOST";
	}
	const host = env[key];
	if (
		!(
			host &&
			neonEndpointPattern.test(host) &&
			!host.split(".")[0]?.endsWith("-pooler")
		)
	) {
		throw new MigrationSafetyError(
			`${key} must name the allowed direct Neon endpoint host.`
		);
	}
	return host;
}

export function selectVerifiedDatabaseTarget(
	env: Environment,
	mode: TargetMode
): string {
	const target = selectDatabaseTarget(env, mode);
	if (mode === "push" || loopbackHosts.has(new URL(target).hostname)) {
		return target;
	}
	const { hostname } = new URL(target);
	if (hostname !== expectedEndpointHost(env, mode)) {
		throw new MigrationSafetyError(
			"The database endpoint does not match the allowed Neon target."
		);
	}
	let databaseKey = "NEON_DEVELOPMENT_DATABASE_NAME";
	if (mode === "deploy") {
		databaseKey = "NEON_PRODUCTION_DATABASE_NAME";
	}
	if (
		!env[databaseKey] ||
		decodeURIComponent(new URL(target).pathname.slice(1)) !== env[databaseKey]
	) {
		throw new MigrationSafetyError(
			`${databaseKey} must match the explicitly authorized database name.`
		);
	}
	if (
		mode === "deploy" &&
		hostname === env.NEON_DEVELOPMENT_ENDPOINT_HOST &&
		(!env.NEON_DEVELOPMENT_DATABASE_NAME ||
			env[databaseKey] === env.NEON_DEVELOPMENT_DATABASE_NAME)
	) {
		throw new MigrationSafetyError(
			"Production and development targets must be distinct."
		);
	}
	return target;
}

export function assertMigrationHistory(
	local: LocalMigration[],
	applied: AppliedMigration[],
	hasApplicationTables: boolean
): void {
	if (applied.length === 0 && hasApplicationTables) {
		throw new MigrationSafetyError(
			"Application tables exist without migration history; inspect and reconcile the database first."
		);
	}
	const names = new Set<string>();
	let previousName = "";
	let previousTime = Number.NEGATIVE_INFINITY;
	for (const migration of local) {
		if (
			names.has(migration.name) ||
			migration.name <= previousName ||
			migration.createdAt <= previousTime ||
			!migration.hash
		) {
			throw new MigrationSafetyError(
				"Local migration order or identity is invalid."
			);
		}
		names.add(migration.name);
		previousName = migration.name;
		previousTime = migration.createdAt;
	}
	if (applied.length > local.length) {
		throw new MigrationSafetyError(
			"Database migration history is ahead of this branch."
		);
	}
	for (let index = 0; index < applied.length; index += 1) {
		const row = applied[index];
		const expected = local[index];
		if (!(row && expected)) {
			throw new MigrationSafetyError("Migration history position is missing.");
		}
		if (
			!Number.isSafeInteger(row.id) ||
			row.id <= 0 ||
			(index > 0 && row.id <= (applied[index - 1]?.id ?? 0)) ||
			(row.name !== null && row.name !== expected.name) ||
			row.createdAt !== expected.createdAt ||
			row.hash !== expected.hash
		) {
			throw new MigrationSafetyError(
				`Migration history differs at position ${index + 1}; reconcile the branch before migrating.`
			);
		}
	}
}
