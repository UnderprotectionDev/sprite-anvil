import type {
	PlatformEquivalenceStorage,
	StoredPlatformEquivalenceReport,
	StoredPlatformEquivalenceRun,
} from "../platform-equivalence-storage";

/** An in-memory PlatformEquivalenceStorage with the same insert-once rule as the database store. */
export function createMemoryPlatformEquivalenceStorage(): PlatformEquivalenceStorage {
	const runs = new Map<string, StoredPlatformEquivalenceRun>();
	const reports = new Map<string, StoredPlatformEquivalenceReport>();

	return {
		findReport: (projectId, reportId) => {
			const found = reports.get(reportId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		findRun: (projectId, runId) => {
			const found = runs.get(runId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertReport: (report) => {
			if (reports.has(report.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			reports.set(report.id, structuredClone(report));
			return Promise.resolve({ status: "inserted" });
		},
		insertRun: (run) => {
			if (runs.has(run.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			runs.set(run.id, structuredClone(run));
			return Promise.resolve({ status: "inserted" });
		},
		listReports: (projectId) =>
			Promise.resolve(
				[...reports.values()].filter((report) => report.projectId === projectId)
			),
		listRuns: (projectId) =>
			Promise.resolve(
				[...runs.values()].filter((run) => run.projectId === projectId)
			),
	};
}
