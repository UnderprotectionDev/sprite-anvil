import { useState } from "react";

/** One idempotency key per user action: a retry of the same action reuses it, a new action gets a new one. */
export interface PendingIdempotencyKey {
	/** Forget the key once the action succeeded, so the next action starts fresh. */
	clear: () => void;
	/** The key for the action described by `fingerprint`; generated once and reused while the fingerprint repeats. */
	keyFor: (fingerprint: string) => string;
}

export function createPendingIdempotencyKey(): PendingIdempotencyKey {
	let pending: { fingerprint: string; key: string } | null = null;
	return {
		clear() {
			pending = null;
		},
		keyFor(fingerprint) {
			if (pending?.fingerprint !== fingerprint) {
				pending = { fingerprint, key: crypto.randomUUID() };
			}
			return pending.key;
		},
	};
}

export function usePendingIdempotencyKey() {
	return useState(createPendingIdempotencyKey)[0];
}
