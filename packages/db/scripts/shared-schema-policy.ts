import { MigrationSafetyError } from "./migration-safety-error";

const indexNamePattern = /CREATE (?:UNIQUE )?INDEX (?:"([^"]+)"|([^ ]+)) ON /;
const dropTablePattern = /^DROP TABLE "([^"]+)"(?: CASCADE)?;$/;
const dropColumnPattern = /^ALTER TABLE "([^"]+)" DROP COLUMN "([^"]+)";$/;

interface Entity {
	entityType?: string;
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
		return false;
	});
}

// Normalize only whitespace outside quoted SQL. String literal contents must
// stay exact: changing a default's spaces is a real behavior change.
export function normalizeMigrationSql(statement: string): string {
	const tokens =
		statement.trim().match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[^\s'";]+|;/g) ?? [];
	if (tokens.at(-1) === ";") {
		tokens.pop();
	}
	return tokens.join(" ");
}

export function checkSharedSchemaDiff(
	statements: string[],
	pending: string[],
	historical: string[],
	required: string[],
	actual: string[],
	compatible: boolean
): void {
	const allowed = new Set(historical.map(normalizeMigrationSql));
	const remaining = statements.filter(
		(statement) => !allowed.has(normalizeMigrationSql(statement))
	);
	const actualSet = new Set(actual);
	for (const entry of required) {
		if (!actualSet.has(entry)) {
			throw new MigrationSafetyError(
				"Required shared schema object is missing."
			);
		}
	}
	if (!compatible) {
		if (actual.some((entry) => !required.includes(entry))) {
			throw new MigrationSafetyError(
				"Unexpected shared schema object outside source and historical inventory; run bun run db:doctor."
			);
		}
		const normalized = (values: string[]) =>
			values
				// Snapshot reconciliation migrations may contain only line comments.
				// Keep any executable line, including quoted comment-like literals.
				.filter((value) =>
					value.split("\n").some((line) => {
						const trimmed = line.trim();
						return trimmed.length > 0 && !trimmed.startsWith("--");
					})
				)
				.map(normalizeMigrationSql)
				.sort((left, right) => left.localeCompare(right));
		if (
			JSON.stringify(normalized(remaining)) !==
			JSON.stringify(normalized(pending))
		) {
			throw new MigrationSafetyError(
				`Shared schema differs from the reviewed pending SQL: ${remaining.slice(0, 3).join(" ") || "pending SQL is not represented by the source schema"}. Run bun run db:doctor; reconcile with bun run db:sync. No repair SQL was executed.`
			);
		}
		return;
	}
	const extra = actual
		.filter((entry) => !required.includes(entry))
		.map((entry) => JSON.parse(entry) as unknown[]);
	for (const statement of remaining) {
		const table = dropTablePattern.exec(statement);
		if (
			table &&
			extra.some(
				(entry) =>
					entry[0] === "relation" &&
					entry[1] === "public" &&
					entry[2] === table[1]
			)
		) {
			continue;
		}
		const column = dropColumnPattern.exec(statement);
		if (
			column &&
			extra.some(
				(entry) =>
					entry[0] === "column" &&
					entry[1] === "public" &&
					entry[2] === column[1] &&
					entry[3] === column[2]
			)
		) {
			continue;
		}
		throw new MigrationSafetyError(
			`Required source schema differs from the shared database: ${statement}. Run bun run db:doctor, then bun run db:sync. This was a read-only inspection.`
		);
	}
}
