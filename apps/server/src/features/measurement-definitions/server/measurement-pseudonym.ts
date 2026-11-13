import { createHmac } from "node:crypto";
import type { Pseudonymize } from "./measurement-pseudonym-kind";

/**
 * A keyed one-way pseudonym: the same id always maps to the same value for one
 * key, the kinds never collide, and the id cannot be recovered from it
 * without the key.
 */
export function createMeasurementPseudonymizer(key: string): Pseudonymize {
	if (key.length === 0) {
		throw new Error("A pseudonym key is required.");
	}
	return (kind, id) =>
		createHmac("sha256", key).update(`${kind}:${id}`).digest("hex");
}
