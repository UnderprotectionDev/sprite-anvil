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

test("extra tables cannot introduce triggers, policies, functions or row security", () => {
	for (const unsafe of [
		entry(
			"trigger",
			"public",
			"layouts",
			"side_effect",
			"CREATE TRIGGER side_effect",
			"O"
		),
		entry("policy", "public", "layouts", "own_rows", "*", true, "true", null),
		entry("function", "public", "side_effect", "CREATE FUNCTION side_effect()"),
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

const owner = (definition: string) =>
	entry(
		"constraint",
		"public",
		"records",
		"records_owner_fkey",
		definition,
		true
	);
const ownerColumn = entry(
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
);

test("another branch's nullable column may carry its own FK, unique index and CHECK", () => {
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			ownerColumn,
			owner("FOREIGN KEY (owner_id) REFERENCES layouts(id) ON DELETE SET NULL"),
			entry(
				"index",
				"public",
				"records",
				"CREATE UNIQUE INDEX records_owner_key ON public.records USING btree (owner_id)",
				true,
				true
			),
			entry(
				"constraint",
				"public",
				"records",
				"records_owner_check",
				"CHECK ((owner_id <> ''::text))",
				true
			),
			...extra,
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			ownerColumn,
			owner("FOREIGN KEY (owner_id) REFERENCES records(id) ON DELETE SET NULL"),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			ownerColumn,
			owner("FOREIGN KEY (owner_id) REFERENCES records(id)"),
		])
	).toThrow("foreign key");
});

test("constraints on new columns are rejected when older writes can violate them", () => {
	const rank = entry(
		"column",
		"public",
		"records",
		"rank",
		"integer",
		true,
		"",
		"",
		"0",
		null
	);
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			ownerColumn,
			entry(
				"constraint",
				"public",
				"records",
				"records_owner_present",
				"CHECK ((owner_id IS NOT NULL))",
				true
			),
		])
	).toThrow("Unsupported");
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			rank,
			entry(
				"index",
				"public",
				"records",
				"CREATE UNIQUE INDEX records_rank_key ON public.records USING btree (rank)",
				true,
				true
			),
		])
	).toThrow("Unsupported");
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			rank,
			entry(
				"constraint",
				"public",
				"records",
				"records_rank_check",
				"CHECK ((rank >= 0))",
				true
			),
		])
	).not.toThrow();
});

test("a CHECK must hold for the defaults older writes receive", () => {
	const badRank = entry(
		"column",
		"public",
		"records",
		"rank",
		"integer",
		true,
		"",
		"",
		"-1",
		null
	);
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			badRank,
			entry(
				"constraint",
				"public",
				"records",
				"records_rank_check",
				"CHECK ((rank >= 0))",
				true
			),
		])
	).toThrow("Unsupported");
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			badRank,
			entry(
				"index",
				"public",
				"records",
				"CREATE UNIQUE INDEX records_rank_key ON public.records USING btree (rank) WHERE rank >= 5",
				true,
				true
			),
		])
	).not.toThrow();
});

test("identity and nullable generated columns fill themselves on required tables", () => {
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			entry(
				"column",
				"public",
				"records",
				"seq_no",
				"integer",
				true,
				"a",
				"",
				"nextval('records_seq_no_seq'::regclass)",
				"default"
			),
			entry(
				"column",
				"public",
				"records",
				"slug",
				"text",
				false,
				"",
				"s",
				"lower(id)",
				"default"
			),
			entry(
				"sequence",
				"public",
				"records_seq_no_seq",
				"1",
				"1",
				"1",
				"9",
				"1",
				false
			),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			entry(
				"column",
				"public",
				"records",
				"slug",
				"text",
				true,
				"",
				"s",
				"lower(id)",
				"default"
			),
		])
	).toThrow("Unsupported");
});

test("defaulted NOT NULL columns and plain indexes are accepted, unique indexes on existing columns are not", () => {
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			entry(
				"column",
				"public",
				"records",
				"rank",
				"integer",
				true,
				"",
				"",
				"0",
				null
			),
			entry(
				"index",
				"public",
				"records",
				"CREATE INDEX records_id_idx ON public.records USING btree (id)",
				true,
				true
			),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			entry(
				"column",
				"public",
				"records",
				"rank",
				"integer",
				true,
				"",
				"",
				null,
				null
			),
		])
	).toThrow("Unsupported");
	const uniqueIndex = (columns: string) =>
		entry(
			"index",
			"public",
			"records",
			`CREATE UNIQUE INDEX records_key ON public.records USING btree (${columns})`,
			true,
			true
		);
	// Older writes leave owner_id NULL, and NULLs never conflict.
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			ownerColumn,
			uniqueIndex("owner_id, id"),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [...expected, uniqueIndex("id")])
	).toThrow("Unsupported");
});

test("widened text CHECK lists and enum values are accepted, narrowed ones are not", () => {
	const status = (values: string[]) =>
		entry(
			"constraint",
			"public",
			"records",
			"records_status_check",
			`CHECK ((id = ANY (ARRAY[${values.map((value) => `'${value}'::text`).join(", ")}])))`,
			true
		);
	const kind = (values: string[]) => entry("enum", "public", "kind", values);
	const required = [...expected, status(["a", "b"]), kind(["x", "y"])];
	expect(() =>
		assertRuntimeCatalog(required, [
			...expected,
			status(["a", "b", "c"]),
			kind(["x", "y", "z"]),
			entry("enum", "public", "other_kind", ["new"]),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(required, [
			...expected,
			status(["a"]),
			kind(["x", "y"]),
		])
	).toThrow("Required");
	expect(() =>
		assertRuntimeCatalog(required, [
			...expected,
			status(["a", "b"]),
			kind(["x"]),
		])
	).toThrow("Required");
});

test("sequences owned by another branch's added table are accepted, others are not", () => {
	const sequence = (name: string) =>
		entry("sequence", "public", name, "1", "1", "1", "9", "1", false);
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			...extra,
			sequence("layouts_id_seq"),
		])
	).not.toThrow();
	expect(() =>
		assertRuntimeCatalog(expected, [
			...expected,
			...extra,
			sequence("unrelated_seq"),
		])
	).toThrow("Unsupported schema change from another branch");
});
