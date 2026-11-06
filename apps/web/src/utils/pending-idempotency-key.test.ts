import { expect, test } from "vitest";
import { createPendingIdempotencyKey } from "./pending-idempotency-key";

test("a retry of the same action reuses its key and a different action gets a new one", () => {
	const pending = createPendingIdempotencyKey();
	const first = pending.keyFor("approve:v1");
	expect(pending.keyFor("approve:v1")).toBe(first);
	expect(pending.keyFor("reject:v1")).not.toBe(first);
});

test("after a success the next action starts with a fresh key", () => {
	const pending = createPendingIdempotencyKey();
	const first = pending.keyFor("approve:v1");
	pending.clear();
	expect(pending.keyFor("approve:v1")).not.toBe(first);
});
