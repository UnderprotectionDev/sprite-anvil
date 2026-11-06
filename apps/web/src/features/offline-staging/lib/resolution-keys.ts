/**
 * Idempotency keys for resolving Offline Conflict Records. A retry of the same
 * choice reuses its key, so an uncertain network failure can never produce a
 * second Candidate Version; a different choice gets its own key.
 */
export function createResolutionKeys(
	newKey: () => string = () => crypto.randomUUID()
) {
	const keys = new Map<string, Map<string, string>>();
	return {
		keyFor(conflictId: string, choice: string) {
			const byChoice = keys.get(conflictId) ?? new Map<string, string>();
			keys.set(conflictId, byChoice);
			const existing = byChoice.get(choice);
			if (existing) {
				return existing;
			}
			const created = newKey();
			byChoice.set(choice, created);
			return created;
		},
		/** Forgets the keys of a record once it is resolved. */
		settle(conflictId: string) {
			keys.delete(conflictId);
		},
	};
}
