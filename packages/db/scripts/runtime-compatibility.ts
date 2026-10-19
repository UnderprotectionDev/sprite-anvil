import {
	canHoldWhenNull,
	holdsWhenNull,
	isCheckWidening,
} from "./constraint-widening";
import { MigrationSafetyError } from "./migration-safety-error";

// Another branch's migrations may expand the shared schema. Objects they add
// are accepted when code that never heard of them keeps working: new tables,
// columns older writes can omit, and indexes or constraints that only bind
// those new columns. Required objects stay exact, except that another branch
// may add text CHECK options or enum values.

type CatalogObject = unknown[];
interface CatalogEntry {
	entry: string;
	object: CatalogObject;
}

const safeDeleteAction = /\bON DELETE (?:CASCADE|SET NULL|SET DEFAULT)\b/;
const tableKey = (schema: unknown, table: unknown) =>
	JSON.stringify([schema, table]);
const objectTable = (object: CatalogObject) => tableKey(object[1], object[2]);
const unquote = (value: string) => {
	const trimmed = value.trim();
	return trimmed.startsWith('"')
		? trimmed.slice(1, -1).replaceAll('""', '"')
		: trimmed;
};
const identifierPattern = /^(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)$/;
const indexKeysPattern = /\bUSING \w+ \(/;
const indexOrderPattern = /\s+(?:ASC|DESC|NULLS (?:FIRST|LAST))\b.*$/;
const indexPredicatePattern = / WHERE (.*)$/;
const keyListPattern =
	/^(?:PRIMARY KEY|UNIQUE(?: NULLS NOT DISTINCT)?|FOREIGN KEY) \(/;
const referencePattern =
	/ REFERENCES (?:((?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*))\.)?((?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*))\(/;

function ordinaryTable(object: CatalogObject): boolean {
	return (
		object[0] === "relation" &&
		object[3] === "r" &&
		object[4] === false &&
		object[5] === false
	);
}

const defaultCollation = (object: CatalogObject) =>
	object[9] === null || object[9] === "default";
const plainColumn = (object: CatalogObject) =>
	object[6] === "" && object[7] === "" && defaultCollation(object);
// Older inserts omit the column: it must be nullable or defaulted.
const acceptsOmittedWrites = (object: CatalogObject) =>
	plainColumn(object) && (object[5] === false || object[8] !== null);
// Identity columns always fill themselves; a nullable generated column
// computes its value (possibly NULL), while a NOT NULL generated column may
// reject the rows older code writes.
const acceptsAddedColumn = (object: CatalogObject) =>
	(object[6] !== "" && object[7] === "") ||
	(object[7] !== "" && object[5] === false) ||
	acceptsOmittedWrites(object);
// Older writes leave the column NULL.
const leavesNull = (object: CatalogObject) =>
	plainColumn(object) && object[5] === false && object[8] === null;

function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const character of text) {
		if (character === "(") {
			depth += 1;
		} else if (character === ")") {
			depth -= 1;
		} else if (character === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	parts.push(current.trim());
	return parts.filter(Boolean);
}

function parenthesized(text: string, open: number): string | undefined {
	let depth = 0;
	for (let index = open; index < text.length; index += 1) {
		if (text[index] === "(") {
			depth += 1;
		} else if (text[index] === ")") {
			depth -= 1;
			if (depth === 0) {
				return text.slice(open + 1, index);
			}
		}
	}
}

interface IndexShape {
	columns: string[];
	expressions: boolean;
	nullsNotDistinct: boolean;
	predicate: string;
	unique: boolean;
}

function readIndex(definition: string): IndexShape | undefined {
	const using = indexKeysPattern.exec(definition);
	const keys = using
		? parenthesized(definition, using.index + using[0].length - 1)
		: undefined;
	if (!(using && keys !== undefined)) {
		return;
	}
	const parts = splitTopLevel(keys).map((part) =>
		part.replace(indexOrderPattern, "")
	);
	const where = indexPredicatePattern.exec(definition);
	return {
		unique: definition.startsWith("CREATE UNIQUE INDEX"),
		columns: parts.filter((part) => identifierPattern.test(part)).map(unquote),
		expressions: parts.some((part) => !identifierPattern.test(part)),
		nullsNotDistinct: definition.includes(" NULLS NOT DISTINCT"),
		predicate: where?.[1] ?? "",
	};
}

function constraintColumns(definition: string): string[] | undefined {
	const list = keyListPattern.exec(definition);
	const columns = list
		? parenthesized(definition, list[0].length - 1)
		: undefined;
	return columns === undefined
		? undefined
		: splitTopLevel(columns).map(unquote);
}

function referencedTable(
	definition: string,
	schema: unknown
): string | undefined {
	const target = referencePattern.exec(definition);
	return target
		? tableKey(
				target[1] ? unquote(target[1]) : schema,
				unquote(String(target[2]))
			)
		: undefined;
}

// Columns of a primary key, unique constraint or plain unique index.
function uniqueKey(object: CatalogObject): string[] | undefined {
	if (object[0] === "constraint") {
		const definition = String(object[4]);
		return definition.startsWith("FOREIGN KEY")
			? undefined
			: constraintColumns(definition);
	}
	const index =
		object[0] === "index" ? readIndex(String(object[3])) : undefined;
	return index?.unique && !index.predicate && !index.expressions
		? index.columns
		: undefined;
}

class ForeignAdditions {
	private readonly addedTables: Set<string>;
	private readonly columns = new Map<string, Map<string, CatalogObject>>();
	private readonly addedColumns = new Map<string, Set<string>>();
	private readonly requiredTables: Set<string>;
	private readonly requiredKeys = new Map<string, string[][]>();

	constructor(
		required: CatalogObject[],
		extra: CatalogObject[],
		actual: CatalogObject[]
	) {
		this.requiredTables = new Set(
			required.filter(ordinaryTable).map(objectTable)
		);
		this.addedTables = new Set(extra.filter(ordinaryTable).map(objectTable));
		for (const object of actual.filter((entry) => entry[0] === "column")) {
			const columns = this.columns.get(objectTable(object)) ?? new Map();
			columns.set(String(object[3]), object);
			this.columns.set(objectTable(object), columns);
		}
		for (const object of extra.filter((entry) => entry[0] === "column")) {
			const added = this.addedColumns.get(objectTable(object)) ?? new Set();
			added.add(String(object[3]));
			this.addedColumns.set(objectTable(object), added);
		}
		for (const object of required) {
			const columns = uniqueKey(object);
			if (columns) {
				const keys = this.requiredKeys.get(objectTable(object)) ?? [];
				keys.push(columns);
				this.requiredKeys.set(objectTable(object), keys);
			}
		}
	}

	accepts(object: CatalogObject): boolean {
		const table = objectTable(object);
		switch (object[0]) {
			case "relation":
				return ordinaryTable(object);
			case "enum":
				return true;
			case "column":
				return (
					this.addedTables.has(table) ||
					(this.requiredTables.has(table) && acceptsAddedColumn(object))
				);
			case "index":
				return (
					object[4] === true && object[5] === true && this.acceptsIndex(object)
				);
			case "constraint":
				return object[5] === true && this.acceptsConstraint(object);
			case "sequence":
				return this.ownedByAddition(object);
			default:
				return false;
		}
	}

	// Identity and serial columns own `<table>_<column>_seq`; only additions may.
	private ownedByAddition(object: CatalogObject): boolean {
		for (const [table, columns] of this.columns) {
			const [, name] = JSON.parse(table) as string[];
			for (const column of columns.keys()) {
				const added =
					this.addedTables.has(table) ||
					(this.addedColumns.get(table)?.has(column) ?? false);
				if (added && `${name}_${column}_seq` === object[2]) {
					return true;
				}
			}
		}
		return false;
	}

	private nullColumns(table: string): Set<string> {
		return new Set(
			[...(this.addedColumns.get(table) ?? [])].filter((name) => {
				const column = this.columns.get(table)?.get(name);
				return column !== undefined && leavesNull(column);
			})
		);
	}

	// Older writes fill the added columns with their defaults; the CHECK must
	// hold for that row, which the shared widening evaluator proves per default.
	private olderWriteDefaults(table: string): Map<string, string> {
		const defaults = new Map<string, string>();
		for (const name of this.addedColumns.get(table) ?? new Set<string>()) {
			const column = this.columns.get(table)?.get(name);
			if (column === undefined || leavesNull(column)) {
				continue;
			}
			if (typeof column[8] === "string") {
				defaults.set(name, column[8]);
			}
		}
		return defaults;
	}

	private generatesUnique(table: string, column: string): boolean {
		const object = this.columns.get(table)?.get(column);
		return (
			object !== undefined &&
			(this.addedColumns.get(table)?.has(column) ?? false) &&
			(object[6] !== "" || object[8] === "gen_random_uuid()")
		);
	}

	// A unique key cannot reject an older write when it extends a required key
	// or includes a column older writes leave NULL.
	private acceptsUnique(
		table: string,
		columns: string[],
		nullsNotDistinct: boolean
	): boolean {
		const nulls = this.nullColumns(table);
		return (
			(!nullsNotDistinct && columns.some((column) => nulls.has(column))) ||
			columns.some((column) => this.generatesUnique(table, column)) ||
			(this.requiredKeys.get(table) ?? []).some((key) =>
				key.every((column) => columns.includes(column))
			)
		);
	}

	private acceptsIndex(object: CatalogObject): boolean {
		const table = objectTable(object);
		if (this.addedTables.has(table)) {
			return true;
		}
		const index = readIndex(String(object[3]));
		if (!(index && this.requiredTables.has(table))) {
			return false;
		}
		return (
			!index.unique ||
			(!index.expressions &&
				this.acceptsUnique(table, index.columns, index.nullsNotDistinct)) ||
			(index.predicate !== "" &&
				!canHoldWhenNull(
					index.predicate,
					this.nullColumns(table),
					this.olderWriteDefaults(table)
				))
		);
	}

	private acceptsConstraint(object: CatalogObject): boolean {
		const table = objectTable(object);
		const definition = String(object[4]);
		if (definition.startsWith("FOREIGN KEY")) {
			const target = referencedTable(definition, object[1]);
			if (
				!target ||
				(this.requiredTables.has(target) && !safeDeleteAction.test(definition))
			) {
				throw new MigrationSafetyError(
					`Unsupported foreign key from another branch: ${object.slice(1, 4).join(".")} restricts deletes from a table this workspace uses. Use ON DELETE CASCADE, SET NULL or SET DEFAULT in the owning migration; inspect bun run db:doctor.`
				);
			}
		}
		if (this.addedTables.has(table)) {
			return true;
		}
		if (!this.requiredTables.has(table)) {
			return false;
		}
		const columns = constraintColumns(definition);
		if (definition.startsWith("FOREIGN KEY") && columns) {
			// MATCH SIMPLE skips the check while any referencing column is NULL.
			const nulls = this.nullColumns(table);
			return columns.some((column) => nulls.has(column));
		}
		if (definition.startsWith("UNIQUE") && columns) {
			return this.acceptsUnique(
				table,
				columns,
				definition.startsWith("UNIQUE NULLS NOT DISTINCT")
			);
		}
		if (definition.startsWith("CHECK")) {
			return holdsWhenNull(
				definition,
				this.nullColumns(table),
				this.olderWriteDefaults(table)
			);
		}
		return false;
	}
}

// Another branch may widen a required enum or text CHECK in place.
function isWidenedReplacement(
	expected: CatalogObject,
	actual: CatalogObject
): boolean {
	if (expected[0] === "enum" && actual[0] === "enum") {
		const values = Array.isArray(actual[3]) ? actual[3] : [];
		return (
			expected[1] === actual[1] &&
			expected[2] === actual[2] &&
			Array.isArray(expected[3]) &&
			expected[3].every((value) => values.includes(value))
		);
	}
	return (
		expected[0] === "constraint" &&
		actual[0] === "constraint" &&
		expected.slice(1, 4).every((value, index) => actual[index + 1] === value) &&
		actual[5] === true &&
		String(expected[4]).startsWith("CHECK") &&
		String(actual[4]).startsWith("CHECK") &&
		isCheckWidening(String(expected[4]), String(actual[4]))
	);
}

export function assertRuntimeCatalog(
	expected: string[],
	actual: string[]
): void {
	const actualEntries: CatalogEntry[] = actual.map((entry) => ({
		entry,
		object: JSON.parse(entry) as CatalogObject,
	}));
	const actualSet = new Set(actual);
	const accounted = new Set(expected);
	for (const entry of expected) {
		if (actualSet.has(entry)) {
			continue;
		}
		const object = JSON.parse(entry) as CatalogObject;
		const replacement = actualEntries.find(
			(candidate) =>
				!accounted.has(candidate.entry) &&
				isWidenedReplacement(object, candidate.object)
		);
		if (!replacement) {
			throw new MigrationSafetyError(
				`Required schema object changed or missing: ${object.slice(0, 4).join(".")}. Run bun run db:doctor, then bun run db:sync.`
			);
		}
		accounted.add(replacement.entry);
	}
	const required = expected.map((entry) => JSON.parse(entry) as CatalogObject);
	const extra = actualEntries
		.filter(({ entry }) => !accounted.has(entry))
		.map(({ object }) => object);
	const additions = new ForeignAdditions(
		required,
		extra,
		actualEntries.map(({ object }) => object)
	);
	for (const object of extra) {
		if (!additions.accepts(object)) {
			throw new MigrationSafetyError(
				`Unsupported schema change from another branch: ${object.slice(0, 4).join(".")}. New tables, nullable or defaulted columns, plain indexes, widened text CHECK lists and enum values, and indexes or constraints that only bind new columns are supported. Triggers, policies, functions and constraints on existing columns are not; inspect bun run db:doctor.`
			);
		}
	}
}
