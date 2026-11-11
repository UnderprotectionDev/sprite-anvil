import type {
	NewRuntimeValidationDecision,
	RuntimeValidationStorage,
	StoredRuntimeValidationDecision,
	StoredRuntimeValidationEvidence,
	StoredRuntimeValidationRecord,
} from "../runtime-validation-storage";

/** An in-memory RuntimeValidationStorage with the same insert-only behavior as the database store. */
export function createMemoryRuntimeValidationStorage(): RuntimeValidationStorage & {
	snapshot: () => string;
} {
	const records = new Map<string, StoredRuntimeValidationRecord>();
	const evidence = new Map<string, StoredRuntimeValidationEvidence>();
	const decisions = new Map<string, StoredRuntimeValidationDecision>();
	let decisionSequence = 0;

	return {
		findDecision: (projectId, decisionId) => {
			const found = decisions.get(decisionId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertDecision: (row: NewRuntimeValidationDecision) => {
			const secondOutcome =
				row.kind === "outcome" &&
				[...decisions.values()].some(
					(existing) =>
						existing.kind === "outcome" && existing.recordId === row.recordId
				);
			if (decisions.has(row.id) || secondOutcome) {
				return Promise.resolve({ status: "conflict" });
			}
			decisionSequence += 1;
			decisions.set(row.id, {
				...structuredClone(row),
				sequence: decisionSequence,
			});
			return Promise.resolve({ status: "inserted" });
		},
		listDecisions: (projectId, recordIds) =>
			Promise.resolve(
				[...decisions.values()]
					.filter(
						(row) =>
							row.projectId === projectId && recordIds.includes(row.recordId)
					)
					// Deliberately not in insert order: the store must sort by sequence.
					.sort((left, right) => right.id.localeCompare(left.id))
					.map((row) => structuredClone(row))
			),
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
			const outcomeDecided = [...decisions.values()].some(
				(existing) =>
					existing.kind === "outcome" && existing.recordId === row.recordId
			);
			if (outcomeDecided) {
				return Promise.resolve({ status: "closed" });
			}
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
			JSON.stringify([
				[...records.values()],
				[...evidence.values()],
				[...decisions.values()],
			]),
	};
}
