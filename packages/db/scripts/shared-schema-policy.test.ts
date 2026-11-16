import { expect, test } from "bun:test";
import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { bigint, pgTable } from "drizzle-orm/pg-core";
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
test("source identity sequences are required with exact options, while unrelated or changed sequences fail closed", async () => {
	const decisions = pgTable("runtime_validation_decisions", {
		sequence: bigint("sequence", {
			mode: "number",
		}).generatedAlwaysAsIdentity(),
	});
	const snapshot = await generateDrizzleJson({ decisions });
	const sequence = [
		"sequence",
		"public",
		"runtime_validation_decisions_sequence_seq",
		"1",
		"1",
		"1",
		"9223372036854775807",
		"1",
		false,
	];
	const catalog = [JSON.stringify(sequence)];
	const projected = projectRequiredCatalog(snapshot.ddl, catalog, []);
	expect(projected).toEqual(catalog);
	expect(() =>
		checkSharedSchemaDiff([], [], [], projected, catalog, false)
	).not.toThrow();
	for (const [index, value] of [
		[1, "other_schema"],
		[2, "unrelated_sequence"],
		[3, "2"],
		[4, "2"],
		[5, "0"],
		[6, "100"],
		[7, "2"],
		[8, true],
	] as const) {
		const changed = [...sequence];
		changed[index] = value;
		const actual = [JSON.stringify(changed)];
		const requiredCatalog = projectRequiredCatalog(snapshot.ddl, actual, []);
		expect(requiredCatalog).toEqual([]);
		expect(() =>
			checkSharedSchemaDiff([], [], [], requiredCatalog, actual, false)
		).toThrow("Unexpected");
	}
});

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

test("a pending table created and later altered matches Drizzle's final-state CREATE, and nothing else", () => {
	const pending = [
		'CREATE TABLE "notes" (\n\t"id" text PRIMARY KEY,\n\t"title" text NOT NULL\n);',
		'ALTER TABLE "notes" ADD COLUMN "label" text;',
		'ALTER TABLE "notes" ALTER COLUMN "title" DROP NOT NULL;',
		'ALTER TABLE "notes" ADD CONSTRAINT "notes_label_check" CHECK ("label" <> \'\');',
	];
	const finalCreate =
		'CREATE TABLE "notes" (\n\t"id" text PRIMARY KEY,\n\t"title" text,\n\t"label" text,\n\tCONSTRAINT "notes_label_check" CHECK ("label" <> \'\')\n);';
	expect(() =>
		checkSharedSchemaDiff([finalCreate], pending, [], required, required, false)
	).not.toThrow();
	// A table the pending SQL does not create is still an unreviewed statement.
	expect(() =>
		checkSharedSchemaDiff(
			[finalCreate, 'CREATE TABLE "other" (\n\t"id" text PRIMARY KEY\n);'],
			pending,
			[],
			required,
			required,
			false
		)
	).toThrow("Shared schema differs from the reviewed pending SQL");
	// An ALTER on an existing table is never folded away.
	expect(() =>
		checkSharedSchemaDiff(
			[finalCreate],
			[...pending, 'ALTER TABLE "records" ADD COLUMN "label" text;'],
			[],
			required,
			required,
			false
		)
	).toThrow("Shared schema differs from the reviewed pending SQL");
	// A folded table that the diff never proposes is a mismatch too.
	expect(() =>
		checkSharedSchemaDiff([], pending, [], required, required, false)
	).toThrow("Shared schema differs from the reviewed pending SQL");
});
