import { useMemo } from "react";

/**
 * One idempotency key per distinct request, so a retry of the same request replays the
 * first lock and a changed request never reuses a key.
 */
export function useIdempotencyKey(signature: string): string {
	// biome-ignore lint/correctness/useExhaustiveDependencies: the key must follow the request signature only.
	return useMemo(() => crypto.randomUUID(), [signature]);
}
