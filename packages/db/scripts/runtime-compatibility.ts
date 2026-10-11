import { MigrationSafetyError } from "./migration-safety-error";

// Named reads/inserts tolerate inert columns and tables they do not access.
const inertTypes = new Set([
	"text",
	"boolean",
	"smallint",
	"integer",
	"bigint",
	"real",
	"double precision",
	"uuid",
	"json",
	"jsonb",
	"date",
	"timestamp without time zone",
	"timestamp with time zone",
	"bytea",
]);
const safeDefault = /^(now\(\)|gen_random_uuid\(\))$/;
const internalConstraint = /^(PRIMARY KEY|UNIQUE) \([a-zA-Z0-9_", ]+\)$/;
const tableKey = (object: unknown[]) => JSON.stringify(object.slice(1, 3));

function ordinaryTable(object: unknown[]): boolean {
	return (
		object[0] === "relation" &&
		object[3] === "r" &&
		object[4] === false &&
		object[5] === false
	);
}
function safeColumn(object: unknown[], newTable: boolean): boolean {
	const defaultAllowed =
		object[8] === null || (newTable && safeDefault.test(String(object[8])));
	return (
		object[0] === "column" &&
		typeof object[4] === "string" &&
		inertTypes.has(object[4]) &&
		(newTable || object[5] === false) &&
		object[6] === "" &&
		object[7] === "" &&
		defaultAllowed &&
		(object[9] === null || object[9] === "default")
	);
}
function safeNewTableObject(object: unknown[]): boolean {
	if (object[0] === "relation") {
		return ordinaryTable(object);
	}
	if (object[0] === "column") {
		return safeColumn(object, true);
	}
	if (object[0] === "index") {
		return object[4] === true && object[5] === true;
	}
	if (
		object[0] !== "constraint" ||
		object[5] !== true ||
		typeof object[4] !== "string"
	) {
		return false;
	}
	if (object[4].startsWith("FOREIGN KEY")) {
		throw new MigrationSafetyError(
			`Unsupported ahead foreign key: ${object.slice(1, 4).join(".")}. It can change existing parent writes; run bun run db:sync to integrate the owning implementation.`
		);
	}
	return internalConstraint.test(object[4]);
}

export function assertRuntimeCatalog(
	expected: string[],
	actual: string[]
): void {
	const actualSet = new Set(actual);
	for (const entry of expected) {
		if (!actualSet.has(entry)) {
			const object = JSON.parse(entry) as unknown[];
			throw new MigrationSafetyError(
				`Required schema object changed or missing: ${object.slice(0, 4).join(".")}. Run bun run db:doctor, then bun run db:sync.`
			);
		}
	}
	const expectedSet = new Set(expected);
	const ordinaryTables = new Set(
		expected
			.map((entry) => JSON.parse(entry) as unknown[])
			.filter(ordinaryTable)
			.map(tableKey)
	);
	const extra = actual
		.filter((entry) => !expectedSet.has(entry))
		.map((entry) => JSON.parse(entry) as unknown[]);
	const addedTables = new Set(extra.filter(ordinaryTable).map(tableKey));
	for (const object of extra) {
		if (addedTables.has(tableKey(object)) && safeNewTableObject(object)) {
			continue;
		}
		if (ordinaryTables.has(tableKey(object)) && safeColumn(object, false)) {
			continue;
		}
		throw new MigrationSafetyError(
			`Unsupported ahead schema change: ${object.slice(0, 4).join(".")}. Independent ordinary tables and inert nullable columns are supported. Defaults, foreign keys, triggers and constraints affecting existing writes require bun run db:sync; inspect bun run db:doctor.`
		);
	}
}
