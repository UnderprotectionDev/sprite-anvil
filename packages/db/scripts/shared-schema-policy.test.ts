import { expect, test } from "bun:test";
import {
	checkSharedSchemaDiff,
	normalizeMigrationSql,
	projectRequiredCatalog,
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
