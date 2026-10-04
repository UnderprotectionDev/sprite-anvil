import { expect, test } from "bun:test";

import {
	selectDeploymentTarget,
	selectDevelopmentTargets,
} from "./development-targets";

const databaseUrl =
	"postgresql://owner:secret@ep-shared.us-east-2.aws.neon.tech/app";

test("development readiness requires an explicit endpoint and database identity", () => {
	expect(() =>
		selectDevelopmentTargets({ DATABASE_URL: databaseUrl })
	).toThrow();
	expect(() =>
		selectDevelopmentTargets({
			DATABASE_URL: databaseUrl,
			NEON_DEVELOPMENT_ENDPOINT_HOST: new URL(databaseUrl).hostname,
		})
	).toThrow();
});

test("development uses exactly one shared database declaration", () => {
	expect(() =>
		selectDevelopmentTargets({
			DATABASE_URL: databaseUrl,
			SECOND_DATABASE_URL: databaseUrl.replace("/app", "/secondary"),
			DB_DEVELOPMENT_TARGETS: JSON.stringify([
				{
					name: "application",
					connectionEnv: "DATABASE_URL",
					host: new URL(databaseUrl).hostname,
					database: "app",
				},
				{
					name: "secondary",
					connectionEnv: "SECOND_DATABASE_URL",
					host: new URL(databaseUrl).hostname,
					database: "secondary",
				},
			]),
		})
	).toThrow("exactly one");
});

test("a development declaration cannot reuse the production database", () => {
	expect(() =>
		selectDevelopmentTargets({
			DATABASE_URL: databaseUrl,
			NEON_DEVELOPMENT_ENDPOINT_HOST: new URL(databaseUrl).hostname,
			NEON_DEVELOPMENT_DATABASE_NAME: "app",
			NEON_PRODUCTION_ENDPOINT_HOST: new URL(databaseUrl).hostname,
			NEON_PRODUCTION_DATABASE_NAME: "app",
		})
	).toThrow();
});

test("deployment rejects development targets declared through the multi-database configuration", () => {
	expect(() =>
		selectDeploymentTarget({
			DATABASE_URL: databaseUrl,
			DB_MIGRATE_TARGET: "production",
			DB_MIGRATE_DEPLOY_CONFIRM: "production",
			NEON_PRODUCTION_ENDPOINT_HOST: new URL(databaseUrl).hostname,
			NEON_PRODUCTION_DATABASE_NAME: "app",
			DB_DEVELOPMENT_TARGETS: JSON.stringify([
				{
					name: "application",
					connectionEnv: "DATABASE_URL",
					host: new URL(databaseUrl).hostname,
					database: "app",
				},
			]),
		})
	).toThrow("distinct");
});
