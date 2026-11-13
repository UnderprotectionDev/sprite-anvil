import { createHmac } from "node:crypto";
import type { PseudonymKind } from "./measurement-event-store";

/**
 * A keyed one-way pseudonym: the same id always maps to the same value for one
 * key, the kinds never collide, and the id cannot be recovered from it
 * without the key.
 */
export function createMeasurementPseudonymizer(key: string) {
	if (key.length === 0) {
		throw new Error("A pseudonym key is required.");
	}
	return (kind: PseudonymKind, id: string): string =>
		createHmac("sha256", key).update(`${kind}:${id}`).digest("hex");
}
