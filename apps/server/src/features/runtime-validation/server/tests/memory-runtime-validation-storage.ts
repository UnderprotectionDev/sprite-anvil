import type {
	RuntimeValidationStorage,
	StoredRuntimeValidationEvidence,
	StoredRuntimeValidationRecord,
} from "../runtime-validation-storage";

/** An in-memory RuntimeValidationStorage with the same insert-only behavior as the database store. */
export function createMemoryRuntimeValidationStorage(): RuntimeValidationStorage & {
	snapshot: () => string;
} {
	const records = new Map<string, StoredRuntimeValidationRecord>();
	const evidence = new Map<string, StoredRuntimeValidationEvidence>();

	return {
		findEvidence: (projectId, evidenceId) => {
			const found = evidence.get(evidenceId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		findRecord: (projectId, recordId) => {
			const found = records.get(recordId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertEvidence: (row) => {
			if (evidence.has(row.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			evidence.set(row.id, structuredClone(row));
			return Promise.resolve({ status: "inserted" });
		},
		insertRecord: (row) => {
			if (records.has(row.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			records.set(row.id, structuredClone(row));
			return Promise.resolve({ status: "inserted" });
		},
		listEvidence: (projectId, recordIds) =>
			Promise.resolve(
				[...evidence.values()]
					.filter(
						(row) =>
							row.projectId === projectId && recordIds.includes(row.recordId)
					)
					.map((row) => structuredClone(row))
			),
		listRecords: (projectId, bundleId) =>
			Promise.resolve(
				[...records.values()]
					.filter(
						(row) =>
							row.projectId === projectId &&
							(bundleId === undefined || row.bundleId === bundleId)
					)
					.map((row) => structuredClone(row))
			),
		snapshot: () =>
			JSON.stringify([[...records.values()], [...evidence.values()]]),
	};
}
