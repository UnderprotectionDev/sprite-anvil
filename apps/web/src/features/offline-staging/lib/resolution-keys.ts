/**
 * Idempotency keys for resolving Offline Conflict Records. A retry of the same
 * choice reuses its key, so an uncertain network failure can never produce a
 * second Candidate Version; a different choice gets its own key.
 */
export function createResolutionKeys(
	newKey: () => string = () => crypto.randomUUID()
) {
	const keys = new Map<string, string>();
	return {
		keyFor(conflictId: string, choice: string) {
			const id = `${conflictId}:${choice}`;
			const existing = keys.get(id);
			if (existing) {
				return existing;
			}
			const created = newKey();
			keys.set(id, created);
			return created;
		},
		/** Forgets the keys of a record once it is resolved. */
		settle(conflictId: string) {
			for (const id of keys.keys()) {
				if (id.startsWith(`${conflictId}:`)) {
					keys.delete(id);
				}
			}
		},
	};
}
