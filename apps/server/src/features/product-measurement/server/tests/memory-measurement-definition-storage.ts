import type {
	MeasurementDefinitionStorage,
	StoredMeasurementDefinition,
} from "../measurement-definition-storage";

/**
 * An in-memory MeasurementDefinitionStorage with the same uniqueness rules as
 * the database store: one row per id and one version number per owner and
 * metric. Reads return copies, as a database read does.
 */
export function createMemoryMeasurementDefinitionStorage() {
	const rows: StoredMeasurementDefinition[] = [];
	let pendingConflicts = 0;

	const storage: MeasurementDefinitionStorage = {
		findById: (id) => {
			const row = rows.find((candidate) => candidate.id === id);
			return Promise.resolve(row ? structuredClone(row) : null);
		},
		insert: (definition) => {
			if (rows.some((row) => row.id === definition.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			if (pendingConflicts > 0) {
				pendingConflicts -= 1;
				return Promise.resolve({ status: "conflict" });
			}
			const stored: StoredMeasurementDefinition = {
				...structuredClone(definition),
				version:
					Math.max(
						0,
						...rows
							.filter(
								(row) =>
									row.ownerUserId === definition.ownerUserId &&
									row.metricId === definition.metricId
							)
							.map((row) => row.version)
					) + 1,
			};
			rows.push(stored);
			return Promise.resolve({
				definition: structuredClone(stored),
				status: "inserted",
			});
		},
		listForOwner: (ownerUserId) =>
			Promise.resolve(
				rows
					.filter((row) => row.ownerUserId === ownerUserId)
					.map((row) => structuredClone(row))
			),
	};

	return {
		/** Makes the next `count` inserts lose the version-number race, as a concurrent activation would. */
		failNextInserts: (count: number) => {
			pendingConflicts = count;
		},
		storage,
	};
}
