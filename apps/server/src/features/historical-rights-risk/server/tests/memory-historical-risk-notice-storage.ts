import type {
	HistoricalRiskNoticeStorage,
	StoredHistoricalRiskNotice,
} from "../historical-risk-notice-storage";

/** An in-memory HistoricalRiskNoticeStorage with the same insert-only behavior as the database store. */
export function createMemoryHistoricalRiskNoticeStorage(): HistoricalRiskNoticeStorage & {
	snapshot: () => string;
} {
	const rows = new Map<string, StoredHistoricalRiskNotice>();
	const uniqueKey = (fulfilmentId: string, rightsRecordId: string) =>
		`${fulfilmentId}:${rightsRecordId}`;
	return {
		findNotice: (projectId, fulfilmentId, rightsRecordId) => {
			const found = rows.get(uniqueKey(fulfilmentId, rightsRecordId));
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertNotice: (notice) => {
			const key = uniqueKey(notice.fulfilmentId, notice.rightsRecordId);
			if (rows.has(key)) {
				return Promise.resolve({ status: "conflict" });
			}
			rows.set(key, structuredClone(notice));
			return Promise.resolve({ status: "inserted" });
		},
		listNotices: (projectId, deliveryTargetId) =>
			Promise.resolve(
				[...rows.values()]
					.filter(
						(row) =>
							row.projectId === projectId &&
							row.deliveryTargetId === deliveryTargetId
					)
					// Deliberately unordered: the store decides the order.
					.sort((left, right) => left.id.localeCompare(right.id))
					.map((row) => structuredClone(row))
			),
		snapshot: () => JSON.stringify([...rows.values()]),
	};
}
