import { MigrationSafetyError } from "./migration-safety-error";

const indexNamePattern = /CREATE (?:UNIQUE )?INDEX (?:"([^"]+)"|([^ ]+)) ON /u;
const dropTablePattern = /^DROP TABLE "([^"]+)"(?: CASCADE)?;$/u;
const dropColumnPattern = /^ALTER TABLE "([^"]+)" DROP COLUMN "([^"]+)";$/u;

interface Entity {
	entityType?: string;
	identity?: {
		name: string;
		startWith: string | null;
		increment: string | null;
		minValue: string | null;
		maxValue: string | null;
		cache: number | null;
		cycle: boolean | null;
	} | null;
	name?: string;
	schema?: string;
	table?: string;
}

export function projectRequiredCatalog(
	ddl: Entity[],
	actual: string[],
	historical: string[]
): string[] {
	const tables = new Set(
		ddl
			.filter((entry) => entry.entityType === "tables")
			.map((entry) => JSON.stringify([entry.schema, entry.name]))
	);
	const columns = new Set(
		ddl
			.filter((entry) => entry.entityType === "columns")
			.map((entry) => JSON.stringify([entry.schema, entry.table, entry.name]))
	);
	const constraints = new Set(
		ddl
			.filter((entry) =>
				["pks", "uniques", "checks", "fks"].includes(entry.entityType ?? "")
			)
			.map((entry) => JSON.stringify([entry.schema, entry.table, entry.name]))
	);
	const indexes = new Set(
		ddl
			.filter((entry) =>
				["indexes", "pks", "uniques"].includes(entry.entityType ?? "")
			)
			.map((entry) => JSON.stringify([entry.schema, entry.table, entry.name]))
	);
	const enums = new Set(
		ddl
			.filter((entry) => entry.entityType === "enums")
			.map((entry) => JSON.stringify([entry.schema, entry.name]))
	);
	// Identity sequences live on column entities in Drizzle's snapshot. Match
	// every catalog option so unrelated sequences and changed settings stay drift.
	const sequences = new Set(
		ddl.flatMap((entry) => {
			const { identity } = entry;
			return entry.entityType === "columns" && identity
				? [
						JSON.stringify([
							"sequence",
							entry.schema,
							identity.name,
							identity.startWith,
							identity.increment,
							identity.minValue,
							identity.maxValue,
							String(identity.cache),
							identity.cycle,
						]),
					]
				: [];
		})
	);
	return actual.filter((entry) => {
		if (historical.includes(entry)) {
			return true;
		}
		const object = JSON.parse(entry) as unknown[];
		if (object[0] === "relation") {
			return tables.has(JSON.stringify(object.slice(1, 3)));
		}
		if (object[0] === "column") {
			return columns.has(JSON.stringify(object.slice(1, 4)));
		}
		if (object[0] === "constraint") {
			return constraints.has(JSON.stringify(object.slice(1, 4)));
		}
		if (object[0] === "index") {
			const match = indexNamePattern.exec(String(object[3]));
			return match
				? indexes.has(
						JSON.stringify([object[1], object[2], match[1] ?? match[2]])
					)
				: false;
		}
		if (object[0] === "enum") {
			return enums.has(JSON.stringify(object.slice(1, 3)));
		}
		if (object[0] === "sequence") {
			return sequences.has(JSON.stringify(object));
		}
		return false;
	});
}

// Normalize only whitespace outside quoted SQL. String literal contents must
// stay exact: changing a default's spaces is a real behavior change.
export function normalizeMigrationSql(statement: string): string {
	const tokens =
		statement.trim().match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[^\s'";]+|;/gu) ?? [];
	if (tokens.at(-1) === ";") {
		tokens.pop();
	}
	return tokens.join(" ");
}

const executable = (statement: string) =>
	// Snapshot reconciliation migrations may contain only line comments.
	// Keep any executable line, including quoted comment-like literals.
	statement.split("\n").some((line) => {
		const trimmed = line.trim();
		return trimmed.length > 0 && !trimmed.startsWith("--");
	});

const dropIndexPattern = /^DROP INDEX "([^"]+)";$/u;
const dropConstraintPattern =
	/^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)";$/u;
const dropTypePattern = /^DROP TYPE "([^"]+)";$/u;
const createEnumPattern = /^CREATE TYPE "([^"]+)" AS ENUM\(.*\);$/u;
const retypeColumnPattern =
	/^ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DATA TYPE (?:text|"([^"]+)" USING "[^"]+"::"[^"]+");$/u;
const alterTablePattern = /^ALTER TABLE "([^"]+)" (.*);$/su;
const constraintActionPattern = /,\s*(?=(?:DROP|ADD) CONSTRAINT ")/u;
const redefinitionPattern =
	/^(?:DROP CONSTRAINT "([^"]+)"|ADD CONSTRAINT "([^"]+)" CHECK \(.*\))$/su;

/**
 * Drizzle's push diff (database -> source) proposes undoing everything another
 * branch added. Those statements describe accepted foreign additions, not work
 * this workspace must apply.
 */
function undoesForeignAddition(
	statement: string,
	extra: unknown[][],
	actual: unknown[][],
	widenedEnums: Set<string>
): boolean {
	const trimmed = statement.trim();
	const has = (predicate: (object: unknown[]) => boolean) =>
		extra.some(predicate);
	const table = dropTablePattern.exec(trimmed);
	if (table) {
		return has(
			(object) =>
				object[0] === "relation" &&
				object[1] === "public" &&
				object[2] === table[1]
		);
	}
	const column = dropColumnPattern.exec(trimmed);
	if (column) {
		return has(
			(object) =>
				object[0] === "column" &&
				object[1] === "public" &&
				object[2] === column[1] &&
				object[3] === column[2]
		);
	}
	const constraint = dropConstraintPattern.exec(trimmed);
	if (constraint) {
		return has(
			(object) =>
				object[0] === "constraint" &&
				object[1] === "public" &&
				object[2] === constraint[1] &&
				object[3] === constraint[2]
		);
	}
	const index = dropIndexPattern.exec(trimmed);
	if (index) {
		return has(
			(object) =>
				object[0] === "index" &&
				object[1] === "public" &&
				indexNamePattern
					.exec(String(object[3]))
					?.slice(1)
					.includes(String(index[1])) === true
		);
	}
	const enumName =
		dropTypePattern.exec(trimmed)?.[1] ?? createEnumPattern.exec(trimmed)?.[1];
	if (enumName) {
		return (
			widenedEnums.has(`public.${enumName}`) ||
			(dropTypePattern.test(trimmed) &&
				has(
					(object) =>
						object[0] === "enum" &&
						object[1] === "public" &&
						object[2] === enumName
				))
		);
	}
	// Recreating a widened enum retypes its columns through text and back.
	const retype = retypeColumnPattern.exec(trimmed);
	if (retype) {
		const type = actual.find(
			(object) =>
				object[0] === "column" &&
				object[1] === "public" &&
				object[2] === retype[1] &&
				object[3] === retype[2]
		)?.[4];
		return (
			typeof type === "string" &&
			widenedEnums.has(`public.${type}`) &&
			(retype[3] === undefined || retype[3] === type)
		);
	}
	return false;
}

/**
 * Removes pending statements that only redefine an existing same-name CHECK.
 * Drizzle's diff omits same-name CHECK edits; `assertSourceConstraints`
 * verifies the exact expression after application instead.
 */
// Identities of existing CHECKs a statement drops and re-adds, or undefined
// when the statement does anything else.
function checkRedefinitions(
	statement: string,
	existingChecks: Set<string>
): string[] | undefined {
	const match = alterTablePattern.exec(statement.trim());
	if (!match) {
		return;
	}
	const identities: string[] = [];
	for (const action of match[2]?.split(constraintActionPattern) ?? []) {
		const redefinition = redefinitionPattern.exec(action.trim());
		const identity = `public.${match[1]}.${redefinition?.[1] ?? redefinition?.[2]}`;
		if (!(redefinition && existingChecks.has(identity))) {
			return;
		}
		identities.push(identity);
	}
	return identities;
}

export function withoutCheckRedefinitions(
	pending: string[],
	existingChecks: Set<string>
): string[] {
	return pending.filter(
		(statement) => !checkRedefinitions(statement, existingChecks)
	);
}

export function redefinedChecks(
	pending: string[],
	existingChecks: Set<string>
): Set<string> {
	return new Set(
		pending.flatMap(
			(statement) => checkRedefinitions(statement, existingChecks) ?? []
		)
	);
}

const createTablePattern = /^CREATE TABLE "([^"]+)" \(/u;
const tableEvolutionPattern =
	/^ALTER TABLE "([^"]+)" (?:ADD COLUMN |ALTER COLUMN |ADD CONSTRAINT "[^"]+" CHECK )/u;

/**
 * Drizzle's push diff creates a table in its final shape, while pending SQL
 * may create it and alter it in later migrations. For a table the pending SQL
 * creates and then evolves, compare only that the CREATE is proposed; the
 * ALTERs are absorbed into it. The final table definition is verified inside
 * the migration transaction before COMMIT.
 */
function foldPendingTableEvolution(
	statements: string[],
	pending: string[]
): { statements: string[]; pending: string[] } {
	const created = new Set(
		pending.flatMap((statement) => {
			const name = createTablePattern.exec(statement.trim())?.[1];
			return name ? [name] : [];
		})
	);
	const evolved = new Set(
		pending.flatMap((statement) => {
			const name = tableEvolutionPattern.exec(statement.trim())?.[1];
			return name && created.has(name) ? [name] : [];
		})
	);
	const marker = (statement: string) => {
		const name = createTablePattern.exec(statement.trim())?.[1];
		return name && evolved.has(name) ? `CREATE TABLE "${name}";` : statement;
	};
	const absorbed = (statement: string) => {
		const name = tableEvolutionPattern.exec(statement.trim())?.[1];
		return name !== undefined && evolved.has(name);
	};
	return {
		statements: statements.map(marker),
		pending: pending.filter((statement) => !absorbed(statement)).map(marker),
	};
}

export function checkSharedSchemaDiff(
	statements: string[],
	pending: string[],
	historical: string[],
	required: string[],
	actual: string[],
	foreign: boolean,
	widenedEnums: Set<string> = new Set()
): void {
	const folded = foldPendingTableEvolution(statements, pending);
	const allowed = new Set(historical.map(normalizeMigrationSql));
	const actualSet = new Set(actual);
	for (const entry of required) {
		if (!actualSet.has(entry)) {
			throw new MigrationSafetyError(
				"Required shared schema object is missing."
			);
		}
	}
	const extraEntries = actual.filter((entry) => !required.includes(entry));
	if (!foreign && extraEntries.length > 0) {
		throw new MigrationSafetyError(
			"Unexpected shared schema object outside source and historical inventory; run bun run db:doctor."
		);
	}
	const extra = extraEntries.map((entry) => JSON.parse(entry) as unknown[]);
	const actualObjects = actual.map((entry) => JSON.parse(entry) as unknown[]);
	const remaining = folded.statements.filter(
		(statement) =>
			!(
				allowed.has(normalizeMigrationSql(statement)) ||
				(foreign &&
					undoesForeignAddition(statement, extra, actualObjects, widenedEnums))
			)
	);
	const normalized = (values: string[]) =>
		values
			.filter(executable)
			.map(normalizeMigrationSql)
			.sort((left, right) => left.localeCompare(right));
	const expectedPlan = normalized(folded.pending);
	if (JSON.stringify(normalized(remaining)) === JSON.stringify(expectedPlan)) {
		return;
	}
	throw new MigrationSafetyError(
		expectedPlan.length === 0
			? `Required source schema differs from the shared database: ${remaining.slice(0, 3).join(" ")}. Run bun run db:doctor. This was a read-only inspection; no repair SQL was executed.`
			: `Shared schema differs from the reviewed pending SQL: ${remaining.slice(0, 3).join(" ") || "pending SQL is not represented by the source schema"}. Run bun run db:doctor. No repair SQL was executed.`
	);
}
