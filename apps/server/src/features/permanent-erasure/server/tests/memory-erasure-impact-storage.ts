import type {
	ErasureImpactStorage,
	StoredErasureImpactReport,
} from "../erasure-impact-storage";

/** An in-memory ErasureImpactStorage; a report row is only ever inserted. */
export function createMemoryErasureImpactStorage(): ErasureImpactStorage & {
	rows: Map<string, StoredErasureImpactReport>;
} {
	const rows = new Map<string, StoredErasureImpactReport>();
	return {
		find: (projectId, reportId) => {
			const found = rows.get(reportId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insert: (row) => {
			if (rows.has(row.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			rows.set(row.id, structuredClone(row));
			return Promise.resolve({ status: "inserted" });
		},
		rows,
	};
}
