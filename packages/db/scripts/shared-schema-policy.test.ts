import { expect, test } from "bun:test";
import {
	checkSharedSchemaDiff,
	normalizeMigrationSql,
	projectRequiredCatalog,
	withoutCheckRedefinitions,
} from "./shared-schema-policy";

const table = JSON.stringify([
	"relation",
	"public",
	"records",
	"r",
	false,
	false,
	null,
]);
const column = JSON.stringify([
	"column",
	"public",
	"records",
	"id",
	"text",
	true,
	"",
	"",
	null,
	"default",
]);
const required = [table, column];
test("pending schema plans must match reviewed SQL without accepting arbitrary repair statements", () => {
	expect(() =>
		checkSharedSchemaDiff(
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			required,
			required,
			false
		)
	).not.toThrow();
	expect(() =>
		checkSharedSchemaDiff(
			['DROP TABLE "records";'],
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			required,
			required,
			false
		)
	).toThrow("reviewed pending SQL");
	expect(() =>
		checkSharedSchemaDiff(
			[],
			["UPDATE records SET id = 'changed';"],
			[],
			required,
			required,
			false
		)
	).toThrow();
});
test("a runtime table drop proposal is never executed and only represents an extra table", () => {
	const extra = JSON.stringify([
		"relation",
		"public",
		"layouts",
		"r",
		false,
		false,
		null,
	]);
	expect(() =>
		checkSharedSchemaDiff(
			['DROP TABLE "layouts" CASCADE;'],
			[],
			[],
			required,
			[...required, extra],
			true
		)
	).not.toThrow();
	expect(() =>
		checkSharedSchemaDiff(
			['DROP TABLE "records" CASCADE;'],
			[],
			[],
			required,
			[...required, extra],
			true
		)
	).toThrow("Required source");
});
test("source requirements do not absorb unrelated actual columns and constraints", () => {
	const extras = [
		JSON.stringify([
			"column",
			"public",
			"records",
			"label",
			"text",
			false,
			"",
			"",
			null,
			"default",
		]),
		JSON.stringify([
			"constraint",
			"public",
			"records",
			"block_old",
			"CHECK (id <> 'old')",
			true,
		]),
	];
	expect(
		projectRequiredCatalog(
			[
				{ entityType: "tables", schema: "public", name: "records" },
				{
					entityType: "columns",
					schema: "public",
					table: "records",
					name: "id",
				},
			],
			[...required, ...extras],
			[]
		)
	).toEqual(required);
	expect(() =>
		checkSharedSchemaDiff([], [], [], required, [...required, ...extras], false)
	).toThrow("Unexpected");
});
test("SQL normalization preserves quoted literal changes", () => {
	expect(normalizeMigrationSql(" SELECT  'a  b' ; ")).toBe("SELECT 'a  b'");
	expect(normalizeMigrationSql("SELECT 'a b';")).not.toBe(
		normalizeMigrationSql("SELECT 'a  b';")
	);
});

test("snapshot reconciliation comments are inert but cannot hide executable pending SQL", () => {
	expect(() =>
		checkSharedSchemaDiff(
			[],
			[
				"-- Reconcile snapshots.\n-- Original migrations already create the tables.\n",
			],
			[],
			required,
			required,
			false
		)
	).not.toThrow();
	for (const pending of [
		"-- Reconcile snapshots.\nUPDATE records SET id = 'changed';",
		"SELECT '-- not a comment';",
	]) {
		expect(() =>
			checkSharedSchemaDiff([], [pending], [], required, required, false)
		).toThrow("reviewed pending SQL");
	}
});

test("another branch's records may add columns, constraints, indexes and enum values beside pending SQL", () => {
	const entry = (...values: unknown[]) => JSON.stringify(values);
	const kind = entry("enum", "public", "kind", ["x", "y", "z"]);
	const kindColumn = entry(
		"column",
		"public",
		"records",
		"kind",
		"kind",
		false,
		"",
		"",
		null,
		null
	);
	const extras = [
		entry(
			"column",
			"public",
			"records",
			"owner_id",
			"text",
			false,
			"",
			"",
			null,
			"default"
		),
		entry(
			"constraint",
			"public",
			"records",
			"records_owner_fkey",
			"FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL",
			true
		),
		entry(
			"index",
			"public",
			"records",
			"CREATE UNIQUE INDEX records_owner_key ON public.records USING btree (owner_id)",
			true,
			true
		),
	];
	const foreignRequired = [...required, kind, kindColumn];
	const proposal = [
		'ALTER TABLE "records" DROP CONSTRAINT "records_owner_fkey";',
		'DROP INDEX "records_owner_key";',
		'ALTER TABLE "records" ALTER COLUMN "kind" SET DATA TYPE text;',
		'DROP TYPE "kind";',
		"CREATE TYPE \"kind\" AS ENUM('x', 'y');",
		'ALTER TABLE "records" ALTER COLUMN "kind" SET DATA TYPE "kind" USING "kind"::"kind";',
		'ALTER TABLE "records" DROP COLUMN "owner_id";',
		'ALTER TABLE "records" ADD COLUMN "label" text;',
	];
	expect(() =>
		checkSharedSchemaDiff(
			proposal,
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			foreignRequired,
			[...foreignRequired, ...extras],
			true,
			new Set(["public.kind"])
		)
	).not.toThrow();
	expect(() =>
		checkSharedSchemaDiff(
			proposal,
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			foreignRequired,
			[...foreignRequired, ...extras],
			true
		)
	).toThrow("reviewed pending SQL");
	expect(() =>
		checkSharedSchemaDiff(
			proposal,
			['ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			foreignRequired,
			[...foreignRequired, ...extras],
			false,
			new Set(["public.kind"])
		)
	).toThrow("Unexpected");
});

test("pending same-name CHECK redefinitions are verified after application, not by the schema diff", () => {
	const redefinition =
		'ALTER TABLE "records" DROP CONSTRAINT "records_status_check", ADD CONSTRAINT "records_status_check" CHECK ("status" IN (\'a\', \'b\', \'c\'));';
	const checks = new Set(["public.records.records_status_check"]);
	expect(withoutCheckRedefinitions([redefinition], checks)).toEqual([]);
	expect(
		withoutCheckRedefinitions(
			[
				'ALTER TABLE "records" DROP CONSTRAINT "records_status_check", ADD CONSTRAINT "records_status_check" CHECK ("status" IN (\'a\')), ADD COLUMN "x" text;',
			],
			checks
		)
	).toHaveLength(1);
	expect(
		withoutCheckRedefinitions(
			[
				'ALTER TABLE "records" DROP CONSTRAINT "records_other_check", ADD CONSTRAINT "records_other_check" CHECK ("status" <> \'\');',
			],
			checks
		)
	).toHaveLength(1);
});
