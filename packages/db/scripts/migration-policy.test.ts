import { expect, test } from "bun:test";

import {
	type AppliedMigration,
	assertMigrationHistory,
	type LocalMigration,
	selectDatabaseTarget,
	selectVerifiedDatabaseTarget,
} from "./migration-policy";

const local: [LocalMigration, LocalMigration] = [
	{ name: "20260923172332_first", createdAt: 1, hash: "aaa" },
	{ name: "20260923201437_second", createdAt: 2, hash: "bbb" },
];

const applied: [AppliedMigration] = [
	{ id: 1, name: local[0].name, createdAt: 1, hash: "aaa" },
];

test("accepts an exact applied prefix and a clean empty database", () => {
	expect(() => assertMigrationHistory(local, applied, true)).not.toThrow();
	expect(() => assertMigrationHistory(local, [], false)).not.toThrow();
});

test("accepts matching migration identities after sequence offsets and gaps", () => {
	const history = local.map((migration, index) => ({
		...migration,
		id: 45 + index * 2,
	}));
	expect(() => assertMigrationHistory(local, history, true)).not.toThrow();
	expect(() =>
		assertMigrationHistory(local, [{ ...applied[0], id: 45 }], true)
	).not.toThrow();
});

test("rejects invalid, duplicate and reversed migration record IDs", () => {
	for (const id of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
		expect(() =>
			assertMigrationHistory(local, [{ ...applied[0], id }], true)
		).toThrow();
	}
	for (const id of [44, 45]) {
		expect(() =>
			assertMigrationHistory(
				local,
				[
					{ ...local[0], id: 45 },
					{ ...local[1], id },
				],
				true
			)
		).toThrow();
	}
});

test("sequence offsets do not hide changed or missing migration identities", () => {
	for (const migration of [
		{ ...local[0], hash: "changed" },
		{ ...local[0], createdAt: 2 },
		local[1],
	]) {
		expect(() =>
			assertMigrationHistory(local, [{ ...migration, id: 45 }], true)
		).toThrow();
	}
});

test("rejects untracked tables, ahead history, changed SQL and missing identities", () => {
	expect(() => assertMigrationHistory(local, [], true)).toThrow();
	expect(() =>
		assertMigrationHistory(local, [...applied, ...applied], true)
	).toThrow();
	expect(() =>
		assertMigrationHistory(local, [{ ...applied[0], hash: "changed" }], true)
	).toThrow();
	expect(() =>
		assertMigrationHistory(
			local,
			[{ ...applied[0], name: local[1].name }],
			true
		)
	).toThrow();
	expect(() =>
		assertMigrationHistory(local, [{ ...applied[0], id: 0 }], true)
	).toThrow();
	expect(() =>
		assertMigrationHistory(local, [{ ...applied[0], createdAt: 2 }], true)
	).toThrow();
});

const neonUrl =
	"postgresql://owner:secret@ep-example-123.us-east-2.aws.neon.tech/app?sslmode=require";
const productionUrl = neonUrl.replace("ep-example-123", "ep-production-123");
const trustedEnvironment = {
	NEON_DEVELOPMENT_ENDPOINT_HOST: "ep-example-123.us-east-2.aws.neon.tech",
	NEON_PRODUCTION_ENDPOINT_HOST: "ep-production-123.us-east-2.aws.neon.tech",
	NEON_DEVELOPMENT_DATABASE_NAME: "app",
	NEON_PRODUCTION_DATABASE_NAME: "app",
};

test("rejects a production URL under the development label", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{
				...trustedEnvironment,
				DATABASE_URL: productionUrl,
				DB_MIGRATE_TARGET: "development",
			},
			"migrate"
		)
	).toThrow();
});

test("rejects a development URL under the deployment label", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{
				...trustedEnvironment,
				DATABASE_URL: neonUrl,
				DB_MIGRATE_TARGET: "production",
				DB_MIGRATE_DEPLOY_CONFIRM: "production",
			},
			"deploy"
		)
	).toThrow();
});

test("rejects a mismatched direct URL", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{
				...trustedEnvironment,
				DATABASE_URL: neonUrl,
				DATABASE_URL_UNPOOLED: productionUrl,
				DB_MIGRATE_TARGET: "development",
			},
			"migrate"
		)
	).toThrow();
});

test("rejects a direct URL for a different database", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{
				...trustedEnvironment,
				DATABASE_URL: neonUrl,
				DATABASE_URL_UNPOOLED: neonUrl.replace("/app?", "/other?"),
				DB_MIGRATE_TARGET: "development",
			},
			"migrate"
		)
	).toThrow();
});

test("accepts a trusted endpoint and matching pooled and direct URLs", () => {
	const target = selectVerifiedDatabaseTarget(
		{
			...trustedEnvironment,
			DATABASE_URL: neonUrl.replace("ep-example-123", "ep-example-123-pooler"),
			DATABASE_URL_UNPOOLED: neonUrl,
			DB_MIGRATE_TARGET: "development",
		},
		"migrate"
	);
	expect(target).toBe(neonUrl);
});

test("rejects the removed remote test target selector", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{
				DATABASE_URL: neonUrl,
				DB_MIGRATE_TARGET: "test",
			},
			"migrate"
		)
	).toThrow("development");
});

test("missing endpoint configuration fails closed", () => {
	expect(() =>
		selectVerifiedDatabaseTarget(
			{ DATABASE_URL: neonUrl, DB_MIGRATE_TARGET: "development" },
			"migrate"
		)
	).toThrow();
});

test("selects the matching direct Neon endpoint for migrations", () => {
	const target = selectDatabaseTarget(
		{
			DATABASE_URL: neonUrl.replace("ep-example-123", "ep-example-123-pooler"),
			DATABASE_URL_UNPOOLED: neonUrl,
			DB_MIGRATE_TARGET: "development",
		},
		"migrate"
	);
	expect(new URL(target).hostname).toBe(
		"ep-example-123.us-east-2.aws.neon.tech"
	);
	expect(
		new URL(
			selectDatabaseTarget(
				{
					DATABASE_URL: neonUrl.replace(
						"ep-example-123",
						"ep-example-123-pooler"
					),
					DB_MIGRATE_TARGET: "development",
				},
				"migrate"
			)
		).hostname
	).toBe("ep-example-123.us-east-2.aws.neon.tech");
	expect(() =>
		selectDatabaseTarget(
			{
				DATABASE_URL: neonUrl,
				DATABASE_URL_UNPOOLED: neonUrl.replace(
					"ep-example-123",
					"ep-other-123"
				),
				DB_MIGRATE_TARGET: "development",
			},
			"migrate"
		)
	).toThrow();
});

test("rejects other providers and remote local mode", () => {
	expect(() =>
		selectDatabaseTarget(
			{
				DATABASE_URL: "postgresql://u:p@db.example.com/app",
				DB_MIGRATE_TARGET: "development",
			},
			"migrate"
		)
	).toThrow();
	expect(() =>
		selectDatabaseTarget(
			{ DATABASE_URL: neonUrl, NEON_LOCAL: "true" },
			"migrate"
		)
	).toThrow();
});

test("push requires an explicit disposable loopback database", () => {
	expect(() =>
		selectDatabaseTarget({ DATABASE_URL: neonUrl, NEON_LOCAL: "true" }, "push")
	).toThrow();
	expect(() =>
		selectDatabaseTarget(
			{ DATABASE_URL: "postgresql://u:p@localhost/app" },
			"push"
		)
	).toThrow();
	expect(
		selectDatabaseTarget(
			{
				DATABASE_URL: "postgresql://u:p@localhost/app",
				NEON_LOCAL: "true",
				DB_PUSH_DISPOSABLE: "true",
			},
			"push"
		)
	).toContain("localhost");
});

test("local commands reject a stale direct URL", () => {
	const localTarget = {
		DATABASE_URL: "postgresql://u:p@localhost/app",
		DATABASE_URL_UNPOOLED: neonUrl,
		NEON_LOCAL: "true",
		DB_MIGRATE_TARGET: "development",
		DB_PUSH_DISPOSABLE: "true",
	};
	expect(() => selectDatabaseTarget(localTarget, "migrate")).toThrow();
	expect(() => selectDatabaseTarget(localTarget, "push")).toThrow();
});

test("deployment migration requires explicit deployment selection", () => {
	expect(() =>
		selectDatabaseTarget({ DATABASE_URL: neonUrl }, "deploy")
	).toThrow();
	expect(
		selectDatabaseTarget(
			{
				DATABASE_URL: neonUrl,
				DB_MIGRATE_TARGET: "production",
				DB_MIGRATE_DEPLOY_CONFIRM: "production",
			},
			"deploy"
		)
	).toBe(neonUrl);
});
