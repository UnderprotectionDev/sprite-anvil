import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import {
	canHoldWhenNull,
	holdsWhenNull,
	isCheckWidening,
} from "./constraint-widening";
import { MigrationSafetyError } from "./migration-safety-error";

// Every workspace runs its own branch against one shared development database.
// After the baseline, a migration may only expand the schema: older code that
// never heard of the change must keep reading and writing successfully.

export const expansionBaselinePath = join(
	import.meta.dir,
	"migration-expansion-baseline.json"
);

export interface SnapshotEntity {
	entityType: string;
	name: string;
	schema?: string;
	table?: string;
	[property: string]: unknown;
}

export interface ExpansionMigration {
	ddl: SnapshotEntity[];
	name: string;
	sql: string;
}

export interface ExpansionResult {
	checked: string[];
	contracts: { name: string; reason: string }[];
	violations: { name: string; violations: string[] }[];
}

const safeDeleteActions = new Set(["CASCADE", "SET NULL", "SET DEFAULT"]);
const firstSnapshotParent = "00000000-0000-0000-0000-000000000000";
const contractApproval = /^-- parallel-safety: contract\s+(\S.*?)\s*$/;
const lineBreak = /\r?\n/;

const entitySchema = z
	.object({ entityType: z.string(), name: z.string() })
	.passthrough();
const snapshotSchema = z.object({
	id: z.string(),
	prevIds: z.array(z.string()).min(1),
	ddl: z.array(entitySchema),
});
const baselineSchema = z
	.object({
		version: z.literal(1),
		reason: z.string().min(1),
		migrations: z.array(z.string()).min(1),
	})
	.strict();

function stableJson(value: unknown): string {
	return JSON.stringify(value, (_, entry: unknown) =>
		entry && typeof entry === "object" && !Array.isArray(entry)
			? Object.fromEntries(
					Object.entries(entry).sort(([left], [right]) =>
						left.localeCompare(right)
					)
				)
			: entry
	);
}

const entityKey = (
	entityType: string,
	schema: unknown,
	table: unknown,
	name: unknown
) => JSON.stringify([entityType, schema ?? null, table ?? null, name]);
const keyOf = (entity: SnapshotEntity) =>
	entityKey(entity.entityType, entity.schema, entity.table, entity.name);
const qualified = (schema: unknown, name: unknown) =>
	schema && schema !== "public" ? `${schema}.${name}` : String(name);
const tableName = (entity: SnapshotEntity) =>
	qualified(entity.schema, entity.table);

const stringLiteral = /'(?:''|[^'])*'/g;
const identifierToken = /"((?:[^"]|"")+)"|\b([A-Za-z_][\w$]*)\b/g;

function identifiersIn(expression: string): Set<string> {
	const names = new Set<string>();
	for (const match of expression
		.replace(stringLiteral, "''")
		.matchAll(identifierToken)) {
		names.add(
			match[1] === undefined
				? String(match[2]).toLowerCase()
				: match[1].replaceAll('""', '"')
		);
	}
	return names;
}

class SnapshotChange {
	readonly added: SnapshotEntity[] = [];
	readonly changed: { before: SnapshotEntity; after: SnapshotEntity }[] = [];
	readonly removed: SnapshotEntity[] = [];
	private readonly child: Map<string, SnapshotEntity>;
	private readonly parents: Map<string, SnapshotEntity>[];

	constructor(parents: SnapshotEntity[][], child: SnapshotEntity[]) {
		this.parents = parents.map(
			(ddl) => new Map(ddl.map((entity) => [keyOf(entity), entity]))
		);
		this.child = new Map(child.map((entity) => [keyOf(entity), entity]));
		for (const [key, entity] of this.child) {
			const versions = this.parents
				.map((parent) => parent.get(key))
				.filter((version) => version !== undefined);
			const [before] = versions;
			if (!before) {
				this.added.push(entity);
			} else if (
				versions.every((version) => stableJson(version) !== stableJson(entity))
			) {
				// A merge snapshot inherits any parent's version unchanged.
				this.changed.push({ before, after: entity });
			}
		}
		const [first, ...others] = this.parents;
		for (const [key, entity] of first ?? []) {
			if (!this.child.has(key) && others.every((parent) => parent.has(key))) {
				this.removed.push(entity);
			}
		}
	}

	parentEntity(key: string): SnapshotEntity | undefined {
		for (const parent of this.parents) {
			const entity = parent.get(key);
			if (entity) {
				return entity;
			}
		}
	}

	childEntity(key: string): SnapshotEntity | undefined {
		return this.child.get(key);
	}

	isChanged(key: string): boolean {
		return (
			this.added.some((entity) => keyOf(entity) === key) ||
			this.changed.some(({ after }) => keyOf(after) === key) ||
			this.removed.some((entity) => keyOf(entity) === key)
		);
	}

	existingTable(schema: unknown, table: unknown): boolean {
		return (
			this.parentEntity(entityKey("tables", schema, null, table)) !== undefined
		);
	}

	existingColumn(schema: unknown, table: unknown, column: unknown): boolean {
		return (
			this.parentEntity(entityKey("columns", schema, table, column)) !==
			undefined
		);
	}

	existingColumns(schema: unknown, table: unknown): Set<string> {
		const columns = new Set<string>();
		for (const parent of this.parents) {
			for (const entity of parent.values()) {
				if (
					entity.entityType === "columns" &&
					entity.schema === schema &&
					entity.table === table
				) {
					columns.add(entity.name);
				}
			}
		}
		return columns;
	}

	/** Columns this migration adds to a table, by name. */
	newColumns(schema: unknown, table: unknown): Map<string, SnapshotEntity> {
		return new Map(
			this.added
				.filter(
					(entity) =>
						entity.entityType === "columns" &&
						entity.schema === schema &&
						entity.table === table
				)
				.map((entity) => [entity.name, entity])
		);
	}

	/** Columns this migration adds that older writes leave NULL. */
	newNullColumns(schema: unknown, table: unknown): Set<string> {
		return new Set(
			[...this.newColumns(schema, table).values()]
				.filter(
					(entity) =>
						!entity.notNull &&
						entity.default === null &&
						entity.identity === null &&
						entity.generated === null
				)
				.map((entity) => entity.name)
		);
	}

	/** Unique keys that already constrain the parent table without a predicate. */
	existingKeys(schema: unknown, table: unknown): string[][] {
		const keys: string[][] = [];
		for (const parent of this.parents) {
			for (const entity of parent.values()) {
				if (entity.schema !== schema || entity.table !== table) {
					continue;
				}
				if (entity.entityType === "pks" || entity.entityType === "uniques") {
					keys.push(stringList(entity.columns));
				} else if (
					entity.entityType === "indexes" &&
					entity.isUnique &&
					!entity.where
				) {
					const { columns, expressions } = indexColumns(entity);
					if (expressions.length === 0) {
						keys.push(columns);
					}
				}
			}
		}
		return keys;
	}

	parentByName(
		types: string[],
		schema: unknown,
		table: unknown,
		name: string
	): SnapshotEntity | undefined {
		for (const parent of this.parents) {
			for (const entity of parent.values()) {
				if (
					types.includes(entity.entityType) &&
					entity.name === name &&
					(schema === undefined || entity.schema === schema) &&
					(table === undefined || entity.table === table)
				) {
					return entity;
				}
			}
		}
	}
}

const stringList = (value: unknown) =>
	Array.isArray(value) ? value.map(String) : [];

function indexColumns(entity: SnapshotEntity): {
	columns: string[];
	expressions: string[];
} {
	const entries = Array.isArray(entity.columns)
		? (entity.columns as { value?: unknown; isExpression?: unknown }[])
		: [];
	return {
		columns: entries
			.filter((entry) => !entry.isExpression)
			.map((entry) => String(entry.value)),
		expressions: [
			...entries
				.filter((entry) => entry.isExpression)
				.map((entry) => String(entry.value)),
			...(typeof entity.where === "string" ? [entity.where] : []),
		],
	};
}

const generatedUniqueDefault = /^gen_random_uuid\(\)$/;

// Older code writes rows without the columns this migration adds: they stay
// NULL or take their default. A constraint is safe when such rows always pass.

// A unique key cannot reject an older write when it extends an existing
// unique key, or includes a column older writes leave NULL (NULLs are
// distinct) or fill with a generated unique value.
function uniqueAcceptsOlderWrites(
	change: SnapshotChange,
	entity: SnapshotEntity,
	columns: string[]
): boolean {
	const nullColumns = change.newNullColumns(entity.schema, entity.table);
	const added = change.newColumns(entity.schema, entity.table);
	return (
		(!entity.nullsNotDistinct &&
			columns.some((column) => nullColumns.has(column))) ||
		columns.some((column) => {
			const definition = added.get(column);
			return (
				definition !== undefined &&
				(definition.identity !== null ||
					generatedUniqueDefault.test(String(definition.default)))
			);
		}) ||
		change
			.existingKeys(entity.schema, entity.table)
			.some(
				(key) =>
					key.length > 0 && key.every((column) => columns.includes(column))
			)
	);
}

// A CHECK is safe when it cannot fail for the row older writes get: new
// nullable columns are NULL and the other new columns take their defaults.
function checkAcceptsOlderWrites(
	change: SnapshotChange,
	entity: SnapshotEntity
): boolean {
	const expression = String(entity.value);
	const nullColumns = change.newNullColumns(entity.schema, entity.table);
	const added = change.newColumns(entity.schema, entity.table);
	const existing = change.existingColumns(entity.schema, entity.table);
	const referenced = [...identifiersIn(expression)].filter(
		(name) => added.has(name) || existing.has(name)
	);
	return (
		referenced.length > 0 &&
		holdsWhenNull(
			expression,
			nullColumns,
			olderWriteDefaults(change, entity.schema, entity.table)
		)
	);
}

/** Defaults older writes receive for the new columns of a table. */
function olderWriteDefaults(
	change: SnapshotChange,
	schema: unknown,
	table: unknown
): Map<string, string> {
	const defaults = new Map<string, string>();
	for (const [name, column] of change.newColumns(schema, table)) {
		if (typeof column.default === "string") {
			defaults.set(name, column.default);
		}
	}
	return defaults;
}

const olderWrites = (kind: string, entity: SnapshotEntity) =>
	`adds ${kind} ${entity.name} that older writes to ${tableName(entity)} can violate`;

function foreignKeyViolations(
	change: SnapshotChange,
	entity: SnapshotEntity
): string[] {
	const violations: string[] = [];
	const columns = stringList(entity.columns);
	const nullColumns = change.newNullColumns(entity.schema, entity.table);
	// MATCH SIMPLE skips the check while any referencing column is NULL.
	if (
		change.existingTable(entity.schema, entity.table) &&
		!columns.some((column) => nullColumns.has(column))
	) {
		violations.push(olderWrites("foreign key", entity));
	}
	const action = String(entity.onDelete ?? "").toUpperCase();
	const actionFails = columns.some((column) => {
		const referencing = change.childEntity(
			entityKey("columns", entity.schema, entity.table, column)
		);
		return (
			(action === "SET NULL" && referencing?.notNull) ||
			(action === "SET DEFAULT" &&
				(referencing?.default === null || referencing?.default === undefined))
		);
	});
	if (actionFails) {
		violations.push(
			`adds foreign key ${entity.name} whose ON DELETE ${action} cannot be applied to ${columns.join(", ")} (NOT NULL or without default); deleting a parent row would fail`
		);
	}
	if (
		change.existingTable(entity.schemaTo, entity.tableTo) &&
		!safeDeleteActions.has(action)
	) {
		violations.push(
			`adds foreign key ${entity.name} that restricts deletes from existing table ${qualified(entity.schemaTo, entity.tableTo)} (use ON DELETE CASCADE, SET NULL or SET DEFAULT)`
		);
	}
	return violations;
}

// An existing foreign key may change its delete action or reference only
// toward a safe action; moving columns or targets re-validates older writes.
function changedForeignKeyViolations(
	change: SnapshotChange,
	before: SnapshotEntity,
	after: SnapshotEntity
): string[] {
	const sameShape =
		stableJson([
			before.columns,
			before.schemaTo,
			before.tableTo,
			before.columnsTo,
		]) ===
		stableJson([after.columns, after.schemaTo, after.tableTo, after.columnsTo]);
	const action = String(after.onDelete ?? "").toUpperCase();
	if (
		sameShape &&
		(safeDeleteActions.has(action) ||
			String(before.onDelete ?? "").toUpperCase() === action)
	) {
		return foreignKeyViolations(change, after).filter(
			(violation) => !violation.includes("older writes")
		);
	}
	return foreignKeyViolations(change, after);
}

function removedViolation(entity: SnapshotEntity): string | undefined {
	switch (entity.entityType) {
		case "tables":
			return `drops table ${qualified(entity.schema, entity.name)}`;
		case "columns":
			return `drops column ${tableName(entity)}.${entity.name}`;
		case "uniques":
		case "pks":
			return `drops unique constraint or primary key ${tableName(entity)}.${entity.name}`;
		case "indexes":
			return entity.isUnique ? `drops unique index ${entity.name}` : undefined;
		case "enums":
			return `drops enum ${qualified(entity.schema, entity.name)}`;
		case "checks":
		case "fks":
		case "policies":
			return;
		default:
			return `drops ${entity.entityType} ${qualified(entity.schema, entity.name)}`;
	}
}

function changedColumnViolations(
	before: SnapshotEntity,
	after: SnapshotEntity,
	name: string
): string[] {
	const violations: string[] = [];
	if (
		before.type !== after.type ||
		before.typeSchema !== after.typeSchema ||
		before.dimensions !== after.dimensions
	) {
		violations.push(`changes the type of column ${name}`);
	}
	if (!before.notNull && after.notNull) {
		violations.push(`makes existing column ${name} NOT NULL`);
	}
	if (
		after.notNull &&
		(before.default !== null || before.identity !== null) &&
		after.default === null &&
		after.identity === null &&
		after.generated === null
	) {
		violations.push(`removes the default of NOT NULL column ${name}`);
	}
	if (before.identity === null && after.identity !== null) {
		violations.push(
			`adds an identity to existing column ${name}; older explicit inserts would fail`
		);
	}
	if (stableJson(before.generated) !== stableJson(after.generated)) {
		violations.push(`changes the generated expression of column ${name}`);
	}
	return violations;
}

// A changed unique key only weakens when the new key constrains a subset of
// the rows the old key constrained: a superset of columns, a new predicate or
// relaxing NULLS NOT DISTINCT.
function isWeakerUnique(
	before: SnapshotEntity,
	after: SnapshotEntity
): boolean {
	const beforeColumns = stringList(before.columns);
	const afterColumns = stringList(after.columns);
	if (
		beforeColumns.length === 0 ||
		!beforeColumns.every((column) => afterColumns.includes(column))
	) {
		return false;
	}
	const beforePredicate = typeof before.where === "string" ? before.where : "";
	const afterPredicate = typeof after.where === "string" ? after.where : "";
	if (beforePredicate !== afterPredicate && beforePredicate !== "") {
		return false;
	}
	return !(Boolean(before.nullsNotDistinct) && !after.nullsNotDistinct);
}

function changedViolations(
	change: SnapshotChange,
	before: SnapshotEntity,
	after: SnapshotEntity
): string[] {
	const name = `${tableName(after)}.${after.name}`;
	switch (after.entityType) {
		case "columns":
			return changedColumnViolations(before, after, name);
		case "checks":
			return isCheckWidening(String(before.value), String(after.value))
				? []
				: [
						`narrows or rewrites CHECK ${after.name} on ${tableName(after)}; only adding options to a literal list is allowed`,
					];
		case "uniques":
			return isWeakerUnique(before, after)
				? []
				: [`changes unique constraint or primary key ${name}`];
		case "pks":
			return [`changes unique constraint or primary key ${name}`];
		case "indexes": {
			if (!(before.isUnique || after.isUnique)) {
				return [];
			}
			return before.isUnique && after.isUnique && isWeakerUnique(before, after)
				? []
				: [`changes unique index ${after.name}`];
		}
		case "fks":
			return changedForeignKeyViolations(change, before, after);
		case "enums": {
			const values = new Set(stringList(after.values));
			const removed = stringList(before.values).filter(
				(value) => !values.has(value)
			);
			return removed.length > 0
				? [
						`removes value(s) ${removed.join(", ")} from enum ${qualified(after.schema, after.name)}`,
					]
				: [];
		}
		default:
			return [];
	}
}

function addedViolations(
	change: SnapshotChange,
	entity: SnapshotEntity
): string[] {
	const existingTable = change.existingTable(entity.schema, entity.table);
	switch (entity.entityType) {
		case "columns":
			// Identity columns always fill themselves; a NOT NULL generated column
			// may still compute NULL for the rows older code writes.
			return existingTable &&
				entity.notNull &&
				entity.default === null &&
				entity.identity === null
				? [
						`adds NOT NULL column ${tableName(entity)}.${entity.name} without a default`,
					]
				: [];
		case "checks":
			return existingTable && !checkAcceptsOlderWrites(change, entity)
				? [olderWrites("CHECK", entity)]
				: [];
		case "uniques":
			return existingTable &&
				!uniqueAcceptsOlderWrites(change, entity, stringList(entity.columns))
				? [olderWrites("unique constraint", entity)]
				: [];
		case "pks":
			return existingTable
				? [
						`adds primary key ${entity.name} to existing table ${tableName(entity)}`,
					]
				: [];
		case "indexes": {
			const { columns } = indexColumns(entity);
			const predicate = typeof entity.where === "string" ? entity.where : "";
			const harmless =
				uniqueAcceptsOlderWrites(change, entity, columns) ||
				(predicate !== "" &&
					!canHoldWhenNull(
						predicate,
						change.newNullColumns(entity.schema, entity.table),
						olderWriteDefaults(change, entity.schema, entity.table)
					));
			return existingTable && entity.isUnique && !harmless
				? [olderWrites("unique index", entity)]
				: [];
		}
		case "fks":
			return foreignKeyViolations(change, entity);
		default:
			return [];
	}
}

function snapshotViolations(change: SnapshotChange): string[] {
	return [
		...change.removed.flatMap((entity) => removedViolation(entity) ?? []),
		...change.changed.flatMap(({ before, after }) =>
			changedViolations(change, before, after)
		),
		...change.added.flatMap((entity) => addedViolations(change, entity)),
	];
}

const sqlLexeme =
	/--[^\n]*(?:\n|$)|\/\*[\s\S]*?(?:\*\/|$)|[eE]'(?:\\[\s\S]|''|[^'\\])*'?|'(?:''|[^'])*'?|"(?:""|[^"])*"?|\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?(?:\$\1\$|$)|;|(?:[^-/'"$;eE]|[eE](?!'))+|[\s\S]/g;
const dollarQuote = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;
const escapeString = /^[eE]'/;

// Drop comments, blank string and dollar-quoted literals, and split on
// semicolons outside quoted identifiers.
export function executableStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	for (const [lexeme] of sql.matchAll(sqlLexeme)) {
		if (lexeme.startsWith("--") || lexeme.startsWith("/*")) {
			current += " ";
		} else if (
			lexeme.startsWith("'") ||
			escapeString.test(lexeme) ||
			dollarQuote.test(lexeme)
		) {
			current += "''";
		} else if (lexeme === ";") {
			statements.push(current);
			current = "";
		} else {
			current += lexeme;
		}
	}
	statements.push(current);
	return statements.map((statement) => statement.trim()).filter(Boolean);
}

const identifier = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;
const qualifiedIdentifier = String.raw`(?:${identifier}\s*\.\s*)?(${identifier})`;

function unquoteIdentifier(value: string): string {
	return value.startsWith('"')
		? value.slice(1, -1).replaceAll('""', '"')
		: value.toLowerCase();
}

function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quoted = false;
	let current = "";
	for (const character of text) {
		if (character === '"') {
			quoted = !quoted;
		} else if (!quoted && character === "(") {
			depth += 1;
		} else if (!quoted && character === ")") {
			depth -= 1;
		} else if (!quoted && depth === 0 && character === ",") {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	parts.push(current.trim());
	return parts.filter(Boolean);
}

const keywordRules: [RegExp, string][] = [
	[
		/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\b/i,
		"adds a trigger",
	],
	[/^CREATE\s+(?:OR\s+REPLACE\s+)?RULE\b/i, "adds a rule"],
	[
		/^DO\b/i,
		"runs an anonymous DO block that this check cannot inspect (use the contract approval line if it is intended)",
	],
	[/^(?:CREATE|ALTER)\s+POLICY\b/i, "adds a row-level security policy"],
	[
		/\b(?:ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b/i,
		"enables row-level security",
	],
	[/\bRENAME\b/i, "renames an object"],
	[/^TRUNCATE\b/i, "truncates a table"],
	[
		/^DROP\s+(?:MATERIALIZED\s+VIEW|VIEW|SCHEMA|SEQUENCE|FUNCTION|PROCEDURE|DOMAIN)\b/i,
		"drops a view, schema, sequence, function or domain",
	],
	[/\bSET\s+SCHEMA\b/i, "moves an object to another schema"],
];

const pattern = (source: string) => new RegExp(source, "i");
const qualifiedTable = String.raw`(?:(${identifier})\s*\.\s*)?(${identifier})`;
const sqlPatterns = {
	createdObject: pattern(
		String.raw`^CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?(VIEW|SEQUENCE|FUNCTION|PROCEDURE|DOMAIN)\s+(?:IF\s+NOT\s+EXISTS\s+)?${qualifiedIdentifier}`
	),
	droppedObject: pattern(
		String.raw`^DROP\s+(?:MATERIALIZED\s+)?(VIEW|SEQUENCE|FUNCTION|PROCEDURE|DOMAIN)\s+(?:IF\s+EXISTS\s+)?${qualifiedIdentifier}`
	),
	quotedIdentifier: /"(?:[^"]|"")*"/g,
	dropTable: pattern(
		String.raw`^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\s\S]*?)(?:\s+(?:CASCADE|RESTRICT))?$`
	),
	tableName: pattern(`^${qualifiedIdentifier}$`),
	dropType: pattern(
		String.raw`^DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?${qualifiedIdentifier}`
	),
	dropIndex: pattern(
		String.raw`^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?${qualifiedIdentifier}`
	),
	uniqueIndex: pattern(
		String.raw`^CREATE\s+UNIQUE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(${identifier})\s+ON\s+(?:ONLY\s+)?${qualifiedTable}`
	),
	alterTable: pattern(
		String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${qualifiedTable}\s+([\s\S]+)$`
	),
	dropConstraint: pattern(
		String.raw`^DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(${identifier})`
	),
	addConstraint: pattern(String.raw`^ADD\s+CONSTRAINT\s+(${identifier})`),
	addUnnamedConstraint:
		/^ADD\s+(?:PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i,
	addColumn: pattern(
		String.raw`^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(${identifier})([\s\S]*)$`
	),
	dropColumn: pattern(
		String.raw`^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(${identifier})`
	),
	alterColumn: pattern(
		String.raw`^ALTER\s+(?:COLUMN\s+)?(${identifier})\s+([\s\S]+)$`
	),
	notNull: /\bNOT\s+NULL\b/i,
	defaulted: /\b(?:DEFAULT|GENERATED)\b/i,
	reference: pattern(String.raw`\bREFERENCES\s+${qualifiedIdentifier}`),
	safeDelete: /\bON\s+DELETE\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT)\b/i,
	setType: /^(?:SET\s+DATA\s+)?TYPE\b/i,
	setNotNull: /^SET\s+NOT\s+NULL\b/i,
	dropDefault: /^DROP\s+(?:DEFAULT|IDENTITY|EXPRESSION)\b/i,
};
const constraintTypes = ["checks", "fks", "uniques", "pks"];
const tableSchema = (schema: string | undefined) =>
	schema ? unquoteIdentifier(schema) : "public";

class SqlReview {
	readonly violations: string[] = [];
	private readonly change: SnapshotChange;
	// Temporary helpers created and dropped by the same migration never reach other code.
	private readonly created = new Set<string>();

	constructor(change: SnapshotChange) {
		this.change = change;
	}

	review(statement: string): void {
		if (this.isTemporaryObject(statement)) {
			return;
		}
		const masked = statement.replace(sqlPatterns.quotedIdentifier, '"_"');
		for (const [rule, violation] of keywordRules) {
			if (rule.test(masked)) {
				this.violations.push(violation);
			}
		}
		const dropTable = sqlPatterns.dropTable.exec(statement);
		const dropType = sqlPatterns.dropType.exec(statement);
		const dropIndex = sqlPatterns.dropIndex.exec(statement);
		const uniqueIndex = sqlPatterns.uniqueIndex.exec(statement);
		const alterTable = sqlPatterns.alterTable.exec(statement);
		if (dropTable) {
			for (const target of splitTopLevel(String(dropTable[1]))) {
				const name = sqlPatterns.tableName.exec(target)?.[1];
				this.violations.push(
					`drops table ${name ? unquoteIdentifier(name) : target}`
				);
			}
		} else if (dropType) {
			this.dropType(unquoteIdentifier(String(dropType[1])));
		} else if (dropIndex) {
			this.dropIndex(unquoteIdentifier(String(dropIndex[1])));
		} else if (uniqueIndex) {
			this.addUniqueIndex(
				unquoteIdentifier(String(uniqueIndex[1])),
				tableSchema(uniqueIndex[2]),
				unquoteIdentifier(String(uniqueIndex[3]))
			);
		} else if (alterTable) {
			const schema = tableSchema(alterTable[1]);
			const table = unquoteIdentifier(String(alterTable[2]));
			for (const action of splitTopLevel(String(alterTable[3]))) {
				this.alterTable(schema, table, action);
			}
		}
	}

	private isTemporaryObject(statement: string): boolean {
		const identity = (match: RegExpExecArray) =>
			`${String(match[1]).toUpperCase()} ${unquoteIdentifier(String(match[2]))}`;
		const created = sqlPatterns.createdObject.exec(statement);
		if (created) {
			this.created.add(identity(created));
		}
		const dropped = sqlPatterns.droppedObject.exec(statement);
		return dropped !== null && this.created.has(identity(dropped));
	}

	private dropType(name: string): void {
		const key = entityKey("enums", "public", null, name);
		if (this.change.parentEntity(key) && !this.change.isChanged(key)) {
			this.violations.push(`drops type ${name}`);
		}
	}

	private dropIndex(name: string): void {
		const index = this.change.parentByName(
			["indexes"],
			undefined,
			undefined,
			name
		);
		if (!index) {
			this.violations.push(
				`drops index ${name} that the parent snapshot does not describe`
			);
		} else if (!this.change.isChanged(keyOf(index))) {
			this.violations.push(
				`drops index ${name} without a matching snapshot change`
			);
		}
	}

	private addUniqueIndex(name: string, schema: string, table: string): void {
		if (!this.change.existingTable(schema, table)) {
			return;
		}
		const key = entityKey("indexes", schema, table, name);
		if (!(this.change.childEntity(key) && this.change.isChanged(key))) {
			this.violations.push(
				`adds unique index ${name} that the snapshot does not describe`
			);
		}
	}

	private alterTable(schema: string, table: string, action: string): void {
		const dropConstraint = sqlPatterns.dropConstraint.exec(action);
		const addConstraint = sqlPatterns.addConstraint.exec(action);
		const addColumn = sqlPatterns.addColumn.exec(action);
		const dropColumn = sqlPatterns.dropColumn.exec(action);
		const alterColumn = sqlPatterns.alterColumn.exec(action);
		if (dropConstraint) {
			this.dropConstraint(
				schema,
				table,
				unquoteIdentifier(String(dropConstraint[1]))
			);
		} else if (addConstraint) {
			this.addConstraint(
				schema,
				table,
				unquoteIdentifier(String(addConstraint[1]))
			);
		} else if (sqlPatterns.addUnnamedConstraint.test(action)) {
			if (this.change.existingTable(schema, table)) {
				this.violations.push(
					`adds an unnamed constraint to existing table ${qualified(schema, table)}`
				);
			}
		} else if (addColumn) {
			this.addColumn(
				schema,
				table,
				unquoteIdentifier(String(addColumn[1])),
				String(addColumn[2])
			);
		} else if (dropColumn) {
			const column = unquoteIdentifier(String(dropColumn[1]));
			if (this.change.existingColumn(schema, table, column)) {
				this.violations.push(
					`drops column ${qualified(schema, table)}.${column}`
				);
			}
		} else if (alterColumn) {
			this.alterColumn(
				schema,
				table,
				unquoteIdentifier(String(alterColumn[1])),
				String(alterColumn[2])
			);
		}
	}

	private dropConstraint(schema: string, table: string, name: string): void {
		const constraint = this.change.parentByName(
			constraintTypes,
			schema,
			table,
			name
		);
		const label = `${qualified(schema, table)}.${name}`;
		if (
			constraint?.entityType === "uniques" ||
			constraint?.entityType === "pks"
		) {
			this.violations.push(`drops unique constraint or primary key ${label}`);
		} else if (!constraint && this.change.existingTable(schema, table)) {
			this.violations.push(
				`drops constraint ${label} that the parent snapshot does not describe`
			);
		}
	}

	private addConstraint(schema: string, table: string, name: string): void {
		const described = constraintTypes.some((type) => {
			const key = entityKey(type, schema, table, name);
			return this.change.childEntity(key) && this.change.isChanged(key);
		});
		if (this.change.existingTable(schema, table) && !described) {
			this.violations.push(
				`adds constraint ${name} that the snapshot does not describe on ${qualified(schema, table)}`
			);
		}
	}

	private addColumn(
		schema: string,
		table: string,
		column: string,
		definition: string
	): void {
		if (!this.change.existingTable(schema, table)) {
			return;
		}
		const label = `${qualified(schema, table)}.${column}`;
		// A snapshot-described column is judged by the snapshot rules.
		if (
			!this.change.childEntity(entityKey("columns", schema, table, column)) &&
			sqlPatterns.notNull.test(definition) &&
			!sqlPatterns.defaulted.test(definition)
		) {
			this.violations.push(`adds NOT NULL column ${label} without a default`);
		}
		const reference = sqlPatterns.reference.exec(definition);
		const target = reference ? unquoteIdentifier(String(reference[1])) : "";
		if (
			reference &&
			this.change.existingTable("public", target) &&
			!sqlPatterns.safeDelete.test(definition)
		) {
			this.violations.push(
				`adds foreign key on ${label} that restricts deletes from existing table ${target} (use ON DELETE CASCADE, SET NULL or SET DEFAULT)`
			);
		}
	}

	private alterColumn(
		schema: string,
		table: string,
		column: string,
		alteration: string
	): void {
		if (!this.change.existingColumn(schema, table, column)) {
			return;
		}
		const label = `${qualified(schema, table)}.${column}`;
		const key = entityKey("columns", schema, table, column);
		if (sqlPatterns.setType.test(alteration)) {
			const enumType = this.change.parentEntity(key)?.type;
			const enumChanged =
				typeof enumType === "string" &&
				this.change.isChanged(entityKey("enums", "public", null, enumType));
			if (!(this.change.isChanged(key) || enumChanged)) {
				this.violations.push(`changes the type of column ${label}`);
			}
		} else if (sqlPatterns.setNotNull.test(alteration)) {
			this.violations.push(`makes existing column ${label} NOT NULL`);
		} else if (
			sqlPatterns.dropDefault.test(alteration) &&
			this.change.childEntity(key)?.notNull !== false
		) {
			this.violations.push(`removes the default of NOT NULL column ${label}`);
		}
	}
}

/** Lists the rules a migration breaks for older code on the shared schema. */
export function findExpansionViolations(
	migration: ExpansionMigration,
	parents: SnapshotEntity[][]
): string[] {
	const change = new SnapshotChange(parents, migration.ddl);
	const review = new SqlReview(change);
	for (const statement of executableStatements(migration.sql)) {
		review.review(statement);
	}
	return [...new Set([...snapshotViolations(change), ...review.violations])];
}

/** Returns the reason from a first-line `-- parallel-safety: contract <reason>`. */
export function readContractApproval(sql: string): string | undefined {
	const [firstLine = ""] = sql.split(lineBreak, 1);
	return contractApproval.exec(firstLine)?.[1];
}

export function readExpansionBaseline(path: string): Set<string> {
	try {
		return new Set(
			baselineSchema.parse(JSON.parse(readFileSync(path, "utf8"))).migrations
		);
	} catch (error) {
		throw new MigrationSafetyError(
			`The migration expansion baseline is missing or invalid: ${path}.`,
			{ cause: error }
		);
	}
}

function readSnapshot(
	directory: string,
	name: string
): z.infer<typeof snapshotSchema> | undefined {
	const path = join(directory, name, "snapshot.json");
	if (!existsSync(path)) {
		return;
	}
	try {
		return snapshotSchema.parse(JSON.parse(readFileSync(path, "utf8")));
	} catch (error) {
		throw new MigrationSafetyError(
			`Migration snapshot has an invalid Drizzle format in ${name}.`,
			{ cause: error }
		);
	}
}

/** Checks every migration directory selected by `isChecked`; never connects to a database. */
export function checkMigrationExpansion(
	directory: string,
	isChecked: (name: string) => boolean
): ExpansionResult {
	const names = readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const snapshots = new Map<string, SnapshotEntity[]>([
		[firstSnapshotParent, []],
	]);
	const result: ExpansionResult = {
		checked: [],
		contracts: [],
		violations: [],
	};
	for (const name of names) {
		const snapshot = readSnapshot(directory, name);
		if (snapshot) {
			snapshots.set(snapshot.id, snapshot.ddl);
		}
		if (!isChecked(name)) {
			continue;
		}
		result.checked.push(name);
		const sql = readFileSync(join(directory, name, "migration.sql"), "utf8");
		const reason = readContractApproval(sql);
		if (reason) {
			result.contracts.push({ name, reason });
			continue;
		}
		const parents = snapshot?.prevIds.map((id) => snapshots.get(id));
		const violations =
			snapshot && parents?.every((parent) => parent !== undefined)
				? findExpansionViolations(
						{ name, sql, ddl: snapshot.ddl },
						parents as SnapshotEntity[][]
					)
				: ["has no snapshot with known parents to compare against"];
		if (violations.length > 0) {
			result.violations.push({ name, violations });
		}
	}
	return result;
}

export function formatExpansionFailure(result: ExpansionResult): string {
	return [
		`Parallel-safety check failed: ${result.violations.length} migration(s) after the expansion baseline contract the shared development schema. Other workspaces run older code against the same database.`,
		...result.violations.flatMap(({ name, violations }) => [
			`${name}:`,
			...violations.map((violation) => `  - ${violation}`),
		]),
		"Fix: add columns as nullable or with a default; keep the old column instead of dropping or renaming it and support both shapes in code; keep database constraints broad and enforce the narrower rule in application validation.",
		'A cleanup migration opened after every branch using the old shape has merged may start with "-- parallel-safety: contract <reason>" on its first line.',
	].join("\n");
}

export function formatContractWarnings(result: ExpansionResult): string[] {
	return result.contracts.map(
		({ name, reason }) =>
			`Warning: ${name} is an approved contracting migration (${reason}). Merge it only after every branch using the old shape has merged.`
	);
}

/** Throws a descriptive error when a migration after the baseline is not expansion-only. */
export function assertExpansionOnly(
	directory: string,
	baselinePath = expansionBaselinePath
): ExpansionResult {
	const baseline = readExpansionBaseline(baselinePath);
	const result = checkMigrationExpansion(
		directory,
		(name) => !baseline.has(name)
	);
	if (result.violations.length > 0) {
		throw new MigrationSafetyError(formatExpansionFailure(result));
	}
	return result;
}
