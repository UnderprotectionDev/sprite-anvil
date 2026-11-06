import { expect, test } from "vitest";
import { createResolutionKeys } from "./resolution-keys";

function counter() {
	let n = 0;
	return () => {
		n += 1;
		return `key-${n}`;
	};
}

test("a retry of the same choice reuses its key; another choice gets its own", () => {
	const keys = createResolutionKeys(counter());
	const first = keys.keyFor("c1", "abandon");
	expect(keys.keyFor("c1", "abandon")).toBe(first);
	expect(keys.keyFor("c1", "create-candidate")).not.toBe(first);
});

test("settling one conflict never clears another conflict's keys", () => {
	const keys = createResolutionKeys(counter());
	const other = keys.keyFor("a:b", "abandon");
	keys.keyFor("a", "abandon");
	keys.settle("a");
	expect(keys.keyFor("a:b", "abandon")).toBe(other);
});
