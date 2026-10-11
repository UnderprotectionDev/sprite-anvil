import { expect, test } from "bun:test";
import { assertRuntimeCatalog } from "./runtime-compatibility";

const entry = (...values: unknown[]) => JSON.stringify(values);
const records = entry("relation", "public", "records", "r", false, false, null);
const column = (table: string, name = "id") =>
	entry("column", "public", table, name, "text", true, "", "", null, "default");
const expected = [records, column("records")];
const extra = [
	entry("relation", "public", "layouts", "r", false, false, null),
	column("layouts"),
	entry(
		"constraint",
		"public",
		"layouts",
		"layouts_pkey",
		"PRIMARY KEY (id)",
		true
	),
	entry(
		"index",
		"public",
		"layouts",
		"CREATE UNIQUE INDEX layouts_pkey ON public.layouts USING btree (id)",
		true,
		true
	),
];

test("an independent new table does not block an older workspace", () => {
	expect(() =>
		assertRuntimeCatalog(expected, [...expected, ...extra])
	).not.toThrow();
});

test("extra tables cannot change writes through existing parent foreign keys", () => {
	const fk = entry(
		"constraint",
		"public",
		"layouts",
		"records_fk",
		"FOREIGN KEY (id) REFERENCES records(id) ON DELETE RESTRICT",
		true
	);
	expect(() =>
		assertRuntimeCatalog(expected, [...expected, ...extra, fk])
	).toThrow("foreign key");
});

test("extra tables cannot introduce triggers, custom defaults or row security", () => {
	for (const unsafe of [
		entry(
			"trigger",
			"public",
			"layouts",
			"side_effect",
			"CREATE TRIGGER side_effect",
			"O"
		),
		entry(
			"column",
			"public",
			"layouts",
			"computed",
			"text",
			false,
			"",
			"",
			"custom_function()",
			"default"
		),
	]) {
		expect(() =>
			assertRuntimeCatalog(expected, [...expected, ...extra, unsafe])
		).toThrow();
	}
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			entry("relation", "public", "layouts", "r", true, false, null),
		])
	).toThrow();
});

test("existing required objects remain exact and unknown existing constraints are rejected", () => {
	expect(() => assertRuntimeCatalog(expected, [records, ...extra])).toThrow(
		"Required"
	);
	const check = entry(
		"constraint",
		"public",
		"records",
		"reject_writes",
		"CHECK (id <> 'old')",
		true
	);
	expect(() =>
		assertRuntimeCatalog(expected, [...expected, ...extra, check])
	).toThrow();
});
