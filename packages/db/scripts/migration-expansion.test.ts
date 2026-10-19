import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	generateDrizzleJson,
	generateMigration,
} from "drizzle-kit/api-postgres";
import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	type PgEnum,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import {
	checkMigrationExpansion,
	findExpansionViolations,
	formatExpansionFailure,
	readContractApproval,
	readExpansionBaseline,
} from "./migration-expansion";

const owners = pgTable("owners", { id: text().primaryKey() });
type KindEnum = PgEnum<[string, ...string[]]>;
const kindValues: [string, ...string[]] = ["x", "y"];

// Test builders compose Drizzle tables dynamically.
type RecordColumns = any;
const recordsTable = pgTable as unknown as (
	name: string,
	columns: RecordColumns,
	extra: (table: RecordColumns) => unknown[]
) => RecordColumns;

interface RecordOptions {
	extraColumns?: Record<
		string,
		ReturnType<typeof text | typeof integer | typeof timestamp>
	>;
	kindValues?: [string, ...string[]];
	others?: Record<string, unknown>;
	/** Options of the default status CHECK; `null` leaves the CHECK to `table`. */
	status?: string[] | null;
	table?: (table: RecordColumns) => unknown[];
}

function schemaWith(options: RecordOptions = {}) {
	const kindType: KindEnum = pgEnum("kind", options.kindValues ?? kindValues);
	const status = options.status === undefined ? ["a", "b"] : options.status;
	const columns: RecordColumns = {
		...recordColumns(kindType),
		...options.extraColumns,
	};
	const records = recordsTable("records", columns, (table) => [
		...(status
			? [
					check(
						"records_status_check",
						sql.raw(
							`"status" IN (${status.map((value) => `'${value}'`).join(", ")})`
						)
					),
				]
			: []),
		...(options.table?.(table) ?? []),
	]);
	return { owners, kind: kindType, records, ...options.others };
}

function recordColumns(kindType: KindEnum) {
	return {
		id: text().primaryKey(),
		status: text().notNull(),
		label: text(),
		code: text().notNull().default("none"),
		kind: kindType(),
	};
}

async function migrationBetween(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	sqlOverride?: string
) {
	const parent = await generateDrizzleJson(before);
	const child = await generateDrizzleJson(after, parent.id);
	const migrationSql =
		sqlOverride ??
		(await generateMigration(parent, child)).join(
			"\n--> statement-breakpoint\n"
		);
	return findExpansionViolations(
		{ name: "20261020000000_change", sql: migrationSql, ddl: child.ddl },
		[parent.ddl]
	);
}

const base = schemaWith();

test("expansion-only changes pass", async () => {
	const accepted = [
		schemaWith({
			others: {
				notes: pgTable(
					"notes",
					{
						id: text().primaryKey(),
						recordId: text("record_id").notNull(),
					},
					(table) => [
						foreignKey({
							columns: [table.recordId],
							foreignColumns: [base.records.id],
						}).onDelete("cascade"),
						uniqueIndex("notes_record_key").on(table.recordId),
					]
				),
			},
		}),
		schemaWith({ extraColumns: { summary: text() } }),
		schemaWith({ extraColumns: { rank: integer().notNull().default(0) } }),
		schemaWith({
			table: (table) => [index("records_status_idx").on(table.status)],
		}),
		schemaWith({ status: ["a", "b", "c"] }),
		schemaWith({ kindValues: ["x", "y", "z"] }),
		schemaWith({
			extraColumns: { ownerId: text("owner_id") },
			table: (table) => [
				foreignKey({
					columns: [table.ownerId],
					foreignColumns: [owners.id],
				}).onDelete("set null"),
				uniqueIndex("records_owner_key").on(table.ownerId),
				check("records_owner_check", sql`${table.ownerId} <> ''`),
			],
		}),
	];
	for (const after of accepted) {
		expect(await migrationBetween(base, after)).toEqual([]);
	}
});

test("constraints that older writes cannot violate are not false alarms", async () => {
	const accepted = [
		// A unique key extending the primary key can never reject a write.
		schemaWith({
			table: (table) => [
				uniqueIndex("records_status_id_key").on(table.status, table.id),
			],
		}),
		// Older writes leave a new nullable column NULL, so these never fire.
		schemaWith({
			extraColumns: { referenceId: text("reference_id") },
			table: (table) => [
				uniqueIndex("records_reference_key")
					.on(table.status, table.referenceId)
					.where(sql`${table.referenceId} IS NOT NULL`),
				foreignKey({
					name: "records_reference_fkey",
					columns: [table.id, table.referenceId],
					foreignColumns: [owners.id, owners.id],
				}).onDelete("cascade"),
				check(
					"records_reference_check",
					sql`${table.referenceId} IS NULL OR ${table.status} = 'a'`
				),
			],
		}),
		// Validation proved the default satisfies a CHECK on a new defaulted column.
		schemaWith({
			extraColumns: { rank: integer().notNull().default(0) },
			table: (table) => [check("records_rank_check", sql`${table.rank} >= 0`)],
		}),
		// An OR alternative only widens an existing CHECK.
		schemaWith({
			extraColumns: { referenceId: text("reference_id") },
			status: null,
			table: (table) => [
				check(
					"records_status_check",
					sql`${table.status} IN ('a', 'b') OR ${table.referenceId} IS NOT NULL`
				),
			],
		}),
	];
	for (const after of accepted) {
		expect(await migrationBetween(base, after)).toEqual([]);
	}
	expect(
		await migrationBetween(
			base,
			base,
			"CREATE FUNCTION public.clean(value text) RETURNS text LANGUAGE sql AS $$ SELECT value $$;\n--> statement-breakpoint\nUPDATE records SET label = clean(label);\n--> statement-breakpoint\nDROP FUNCTION public.clean(text);"
		)
	).toEqual([]);
	expect(
		(
			await migrationBetween(base, base, "DROP FUNCTION public.shared(text);")
		).join("\n")
	).toContain("drops a view, schema, sequence, function or domain");
	expect(
		(
			await migrationBetween(
				base,
				schemaWith({
					extraColumns: { referenceId: text("reference_id") },
					table: (table) => [
						check(
							"records_reference_check",
							sql`${table.referenceId} IS NOT NULL OR ${table.status} = 'a'`
						),
					],
				})
			)
		).join("\n")
	).toContain(
		"adds CHECK records_reference_check that older writes to records can violate"
	);
});

test("a new CHECK must hold for the defaults older writes receive", async () => {
	const violating = schemaWith({
		extraColumns: { rank: integer().notNull().default(-1) },
		table: (table) => [check("records_rank_check", sql`${table.rank} >= 0`)],
	});
	expect((await migrationBetween(base, violating)).join("\n")).toContain(
		"adds CHECK records_rank_check that older writes to records can violate"
	);
	const satisfied = schemaWith({
		extraColumns: { rank: integer().notNull().default(0) },
		table: (table) => [check("records_rank_check", sql`${table.rank} >= 0`)],
	});
	expect(await migrationBetween(base, satisfied)).toEqual([]);
	const flipped = schemaWith({
		extraColumns: { rank: integer().notNull().default(0) },
		table: (table) => [check("records_rank_check", sql`${table.rank} > 0`)],
	});
	expect((await migrationBetween(base, flipped)).join("\n")).toContain(
		"adds CHECK records_rank_check that older writes to records can violate"
	);
	const listed = schemaWith({
		extraColumns: { state: text().notNull().default("draft") },
		table: (table) => [
			check("records_state_check", sql`${table.state} IN ('draft', 'done')`),
		],
	});
	expect(await migrationBetween(base, listed)).toEqual([]);
	const mismatched = schemaWith({
		extraColumns: { state: text().notNull().default("draft") },
		table: (table) => [
			check("records_state_check", sql`${table.state} = 'done'`),
		],
	});
	expect((await migrationBetween(base, mismatched)).join("\n")).toContain(
		"adds CHECK records_state_check that older writes to records can violate"
	);
	const unprovable = schemaWith({
		extraColumns: { createdAt: timestamp().notNull().defaultNow() },
		table: (table) => [
			check("records_created_check", sql`${table.createdAt} > '2000-01-01'`),
		],
	});
	expect((await migrationBetween(base, unprovable)).join("\n")).toContain(
		"adds CHECK records_created_check that older writes to records can violate"
	);
});

test("identity columns fill themselves, NOT NULL generated columns cannot be proven", async () => {
	const identity = schemaWith({
		extraColumns: { rank: integer().notNull().generatedAlwaysAsIdentity() },
	});
	expect(await migrationBetween(base, identity)).toEqual([]);
	const generatedNotNull = schemaWith({
		extraColumns: {
			slug: text("slug").notNull().generatedAlwaysAs(sql`"id"`),
		},
	});
	expect((await migrationBetween(base, generatedNotNull)).join("\n")).toContain(
		"adds NOT NULL column records.slug without a default"
	);
	const generatedNullable = schemaWith({
		extraColumns: {
			slug: text("slug").generatedAlwaysAs(sql`"id"`),
		},
	});
	expect(await migrationBetween(base, generatedNullable)).toEqual([]);
});

test("a unique index that only gains a predicate or columns is a weakening change", async () => {
	const plain = schemaWith({
		extraColumns: { referenceId: text("reference_id") },
		table: (table) => [
			uniqueIndex("records_reference_key").on(table.referenceId),
		],
	});
	const predicated = schemaWith({
		extraColumns: { referenceId: text("reference_id") },
		table: (table) => [
			uniqueIndex("records_reference_key")
				.on(table.referenceId)
				.where(sql`${table.referenceId} IS NOT NULL`),
		],
	});
	expect(await migrationBetween(plain, predicated)).toEqual([]);
	expect((await migrationBetween(predicated, plain)).join("\n")).toContain(
		"changes unique index records_reference_key"
	);
	const widenedKey = schemaWith({
		extraColumns: { referenceId: text("reference_id") },
		table: (table) => [
			uniqueIndex("records_reference_key").on(table.status, table.referenceId),
		],
	});
	expect(await migrationBetween(plain, widenedKey)).toEqual([]);
});

test("contracting changes are rejected with the violated rule", async () => {
	const { records: _records, ...withoutRecords } = base;
	const rejected: [Record<string, unknown>, Record<string, unknown>, string][] =
		[
			[base, withoutRecords, "drops table records"],
			[
				schemaWith({ extraColumns: { summary: text() } }),
				base,
				"drops column records.summary",
			],
			[
				schemaWith({ extraColumns: { summary: text() } }),
				schemaWith({ extraColumns: { summary: integer() } }),
				"changes the type of column records.summary",
			],
			[
				base,
				schemaWith({
					extraColumns: { label: text().notNull() },
				}),
				"makes existing column records.label NOT NULL",
			],
			[
				base,
				schemaWith({ extraColumns: { rank: integer().notNull() } }),
				"adds NOT NULL column records.rank without a default",
			],
			[
				base,
				schemaWith({ extraColumns: { code: text().notNull() } }),
				"removes the default of NOT NULL column records.code",
			],
			[
				base,
				schemaWith({
					table: (table) => [
						check("records_label_check", sql`${table.label} <> ''`),
					],
				}),
				"adds CHECK records_label_check that older writes to records can violate",
			],
			[
				base,
				schemaWith({ status: ["a"] }),
				"narrows or rewrites CHECK records_status_check",
			],
			[
				base,
				schemaWith({
					table: (table) => [
						foreignKey({
							name: "records_label_fkey",
							columns: [table.label],
							foreignColumns: [owners.id],
						}).onDelete("set null"),
					],
				}),
				"adds foreign key records_label_fkey that older writes to records can violate",
			],
			[
				base,
				schemaWith({
					table: (table) => [uniqueIndex("records_label_key").on(table.label)],
				}),
				"adds unique index records_label_key that older writes to records can violate",
			],
			[
				base,
				schemaWith({
					table: (table) => [unique("records_label_unique").on(table.label)],
				}),
				"adds unique constraint records_label_unique that older writes to records can violate",
			],
			[
				schemaWith({
					table: (table) => [uniqueIndex("records_label_key").on(table.label)],
				}),
				base,
				"drops unique index records_label_key",
			],
			[
				schemaWith({
					table: (table) => [unique("records_label_unique").on(table.label)],
				}),
				base,
				"drops unique constraint or primary key records.records_label_unique",
			],
			[
				base,
				schemaWith({
					others: {
						notes: pgTable("notes", {
							id: text().primaryKey(),
							recordId: text("record_id").references(() => base.records.id),
						}),
					},
				}),
				"restricts deletes from existing table records",
			],
			[
				base,
				schemaWith({ kindValues: ["x"] }),
				"removes value(s) y from enum kind",
			],
			[
				base,
				schemaWith({
					extraColumns: { reviewed: text() },
					table: (table) => [
						check("records_reviewed_check", sql`${table.reviewed} IS NOT NULL`),
					],
				}),
				"adds CHECK records_reviewed_check that older writes to records can violate",
			],
			[
				base,
				schemaWith({
					extraColumns: { rank: integer().notNull().default(0) },
					table: (table) => [uniqueIndex("records_rank_key").on(table.rank)],
				}),
				"adds unique index records_rank_key that older writes to records can violate",
			],
			[
				base,
				schemaWith({
					extraColumns: { ownerId: text("owner_id").notNull().default("none") },
					table: (table) => [
						foreignKey({
							name: "records_owner_fkey",
							columns: [table.ownerId],
							foreignColumns: [owners.id],
						}).onDelete("cascade"),
					],
				}),
				"adds foreign key records_owner_fkey that older writes to records can violate",
			],
		];
	for (const [before, after, violation] of rejected) {
		const violations = await migrationBetween(before, after);
		expect(violations.join("\n")).toContain(violation);
	}
});

test("SQL-only triggers, rules, policies, row security and renames are rejected", async () => {
	for (const [statement, violation] of <[string, string][]>[
		[
			'CREATE TRIGGER "audit" BEFORE INSERT ON "records" FOR EACH ROW EXECUTE FUNCTION audit();',
			"adds a trigger",
		],
		[
			'CREATE RULE "ignore" AS ON DELETE TO "records" DO INSTEAD NOTHING;',
			"adds a rule",
		],
		[
			'CREATE POLICY "own" ON "records" USING (true);',
			"adds a row-level security policy",
		],
		[
			'ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;',
			"enables row-level security",
		],
		[
			'ALTER TABLE "records" RENAME COLUMN "label" TO "title";',
			"renames an object",
		],
		[
			"DO $a1$ BEGIN EXECUTE 'ALTER TABLE records DROP COLUMN label'; END $a1$;",
			"runs an anonymous DO block",
		],
		[
			'SELECT E\'\\\'\'; ALTER TABLE "records" RENAME COLUMN "label" TO "title"; SELECT \'x\';',
			"renames an object",
		],
		[
			'ALTER TABLE "records" ADD COLUMN "rank" integer NOT NULL;',
			"adds NOT NULL column records.rank without a default",
		],
		[
			'ALTER TABLE "records" ADD CONSTRAINT "records_label_check" CHECK ("label" <> \'\');',
			"adds constraint records_label_check that the snapshot does not describe",
		],
		[
			'DROP INDEX "records_pkey";',
			"drops index records_pkey that the parent snapshot does not describe",
		],
	]) {
		expect(
			(await migrationBetween(base, base, statement)).join("\n")
		).toContain(violation);
	}
	expect(
		await migrationBetween(
			base,
			base,
			"-- Reconcile snapshots only.\n-- 'DROP TABLE records' stays a comment.\n"
		)
	).toEqual([]);
	expect(
		await migrationBetween(
			base,
			base,
			`UPDATE "records" SET "label" = 'DROP TABLE "records"; CREATE TRIGGER';`
		)
	).toEqual([]);
});

test("only a first-line contract approval with a reason is accepted", () => {
	expect(
		readContractApproval(
			"-- parallel-safety: contract drop legacy label after #150 merged\nALTER TABLE x DROP COLUMN y;"
		)
	).toBe("drop legacy label after #150 merged");
	expect(
		readContractApproval(
			"-- parallel-safety: contract   \r\nALTER TABLE x DROP COLUMN y;"
		)
	).toBeUndefined();
	expect(
		readContractApproval(
			"ALTER TABLE x DROP COLUMN y;\n-- parallel-safety: contract legacy cleanup"
		)
	).toBeUndefined();
	expect(
		readContractApproval(
			" -- parallel-safety: contract leading space is not the approval line"
		)
	).toBeUndefined();
});

test("the baseline boundary checks only later migrations and reports contract warnings", async () => {
	const directory = mkdtempSync(join(tmpdir(), "sprite-anvil-expansion-"));
	try {
		const first = await generateDrizzleJson(
			schemaWith({ extraColumns: { summary: text() } })
		);
		const second = await generateDrizzleJson(base, first.id);
		const third = await generateDrizzleJson(
			schemaWith({ extraColumns: { label: text().notNull() } }),
			second.id
		);
		const fourth = await generateDrizzleJson(
			schemaWith({ extraColumns: { label: text().notNull().default("") } }),
			third.id
		);
		const migrations: [string, string, unknown][] = [
			[
				"20261020000001_baseline",
				(await generateMigration(await generateDrizzleJson({}), first)).join(
					"\n--> statement-breakpoint\n"
				),
				first,
			],
			[
				"20261020000002_old_branch_drop",
				'ALTER TABLE "records" DROP COLUMN "summary";',
				second,
			],
			[
				"20261020000003_not_null",
				'ALTER TABLE "records" ALTER COLUMN "label" SET NOT NULL;',
				third,
			],
			[
				"20261020000004_cleanup",
				'-- parallel-safety: contract all branches now write label\nALTER TABLE "records" ALTER COLUMN "label" SET DEFAULT \'\';',
				fourth,
			],
		];
		for (const [name, migrationSql, snapshot] of migrations) {
			mkdirSync(join(directory, name));
			writeFileSync(join(directory, name, "migration.sql"), migrationSql);
			writeFileSync(
				join(directory, name, "snapshot.json"),
				JSON.stringify(snapshot)
			);
		}
		const baseline = new Set(["20261020000001_baseline"]);
		const result = checkMigrationExpansion(
			directory,
			(name) => !baseline.has(name)
		);
		expect(result.checked).toEqual([
			"20261020000002_old_branch_drop",
			"20261020000003_not_null",
			"20261020000004_cleanup",
		]);
		expect(result.violations.map((entry) => entry.name)).toEqual([
			"20261020000002_old_branch_drop",
			"20261020000003_not_null",
		]);
		expect(result.contracts).toEqual([
			{
				name: "20261020000004_cleanup",
				reason: "all branches now write label",
			},
		]);
		const message = formatExpansionFailure(result);
		expect(message).toContain("20261020000003_not_null");
		expect(message).toContain("makes existing column records.label NOT NULL");
		expect(message).toContain("nullable or with a default");
		expect(message).toContain("keep the old column");
		expect(message).toContain("application validation");
		expect(
			checkMigrationExpansion(
				directory,
				(name) => name > "20261020000003_not_null"
			).violations
		).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("committed migrations satisfy the pinned expansion baseline", () => {
	const directory = join(import.meta.dir, "..", "src", "migrations");
	const baseline = readExpansionBaseline(
		join(import.meta.dir, "migration-expansion-baseline.json")
	);
	expect(baseline.has("20261013122547_scene_qa_playgrounds")).toBe(true);
	expect(
		checkMigrationExpansion(directory, (name) => !baseline.has(name)).violations
	).toEqual([]);
});

test("foreign key actions, identity changes and sequences follow older-write safety", async () => {
	const withOwner = (onDelete: "cascade" | "restrict" | "set null") =>
		schemaWith({
			extraColumns: { ownerId: text("owner_id") },
			table: (table) => [
				foreignKey({
					columns: [table.ownerId],
					foreignColumns: [owners.id],
					name: "records_owner_fkey",
				}).onDelete(onDelete),
			],
		});
	// Moving an existing foreign key to a safe delete action only relaxes it.
	expect(
		await migrationBetween(withOwner("restrict"), withOwner("cascade"))
	).toEqual([]);
	// SET NULL cannot apply to a NOT NULL referencing column.
	const notNullOwner = schemaWith({
		extraColumns: { ownerId: text("owner_id").notNull().default("none") },
		table: (table) => [
			foreignKey({
				columns: [table.ownerId],
				foreignColumns: [owners.id],
				name: "records_owner_fkey",
			}).onDelete("set null"),
		],
	});
	expect((await migrationBetween(base, notNullOwner)).join("\n")).toContain(
		"ON DELETE SET NULL cannot be applied"
	);
	// An identity added to an existing column breaks explicit older inserts.
	expect(
		(
			await migrationBetween(
				schemaWith({ extraColumns: { rank: integer() } }),
				schemaWith({
					extraColumns: { rank: integer().generatedAlwaysAsIdentity() },
				})
			)
		).join("\n")
	).toContain("adds an identity to existing column records.rank");
});
