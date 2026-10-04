import { MigrationSafetyError } from "./migration-safety-error";

// Drizzle projects named schema columns and supplies named INSERT columns.
// Only inert nullable additions on existing ordinary tables are supported.
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

export function assertRuntimeCatalog(
	expected: string[],
	actual: string[]
): void {
	const actualSet = new Set(actual);
	for (const entry of expected) {
		if (!actualSet.has(entry)) {
			const object = JSON.parse(entry) as unknown[];
			throw new MigrationSafetyError(
				`Required schema object changed or missing: ${object.slice(0, 4).join(".")}. Reconcile the owning code/schema/history from trusted Git.`
			);
		}
	}
	const expectedSet = new Set(expected);
	const ordinaryTables = new Set(
		expected.flatMap((entry) => {
			const object = JSON.parse(entry) as unknown[];
			return object[0] === "relation" &&
				object[3] === "r" &&
				object[4] === false &&
				object[5] === false
				? [JSON.stringify(object.slice(1, 3))]
				: [];
		})
	);
	for (const entry of actual) {
		if (expectedSet.has(entry)) {
			continue;
		}
		const object = JSON.parse(entry) as unknown[];
		if (
			object[0] === "column" &&
			ordinaryTables.has(JSON.stringify(object.slice(1, 3))) &&
			typeof object[4] === "string" &&
			inertTypes.has(object[4]) &&
			object[5] === false &&
			object[6] === "" &&
			object[7] === "" &&
			object[8] === null &&
			(object[9] === null || object[9] === "default")
		) {
			continue;
		}
		throw new MigrationSafetyError(
			`Unsupported ahead schema change: ${object.slice(0, 4).join(".")}. Only nullable built-in columns without defaults, generation or added constraints are supported; reconcile the owning change from trusted Git.`
		);
	}
}
