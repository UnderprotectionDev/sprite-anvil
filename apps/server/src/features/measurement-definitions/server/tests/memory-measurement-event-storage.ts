import type {
	MeasurementEventStorage,
	StoredMeasurementEvent,
} from "../measurement-event-storage";

/** An in-memory MeasurementEventStorage with the database store's one-row-per-id rule; reads return copies. */
export function createMemoryMeasurementEventStorage() {
	const rows: StoredMeasurementEvent[] = [];

	const storage: MeasurementEventStorage = {
		findById: (id) => {
			const row = rows.find((candidate) => candidate.id === id);
			return Promise.resolve(row ? structuredClone(row) : null);
		},
		listByDefinitionId: (definitionId) =>
			Promise.resolve(
				rows
					.filter((row) => row.definitionId === definitionId)
					.map((row) => structuredClone(row))
			),
		insert: (event) => {
			if (rows.some((row) => row.id === event.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			rows.push(structuredClone(event));
			return Promise.resolve({
				event: structuredClone(event),
				status: "inserted",
			});
		},
	};

	return { rows: () => structuredClone(rows), storage };
}
