/**
 * Limits how often the supervisor re-reads the full shared schema catalog.
 * Each read transfers the whole catalog from the remote database, so running
 * it every second exhausts a metered data-transfer quota.
 */
export function createInspectionGate(
	intervalMs: number,
	now: () => number = Date.now
): () => boolean {
	let last = Number.NEGATIVE_INFINITY;
	return () => {
		const current = now();
		if (current - last < intervalMs) {
			return false;
		}
		last = current;
		return true;
	};
}
