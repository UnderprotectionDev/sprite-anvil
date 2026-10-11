import { expect, test } from "bun:test";
import { assertRuntimeHistory } from "./runtime-history";

const first = {
	name: "20261001000000_first",
	createdAt: Date.UTC(2026, 9, 1),
	hash: "a".repeat(64),
};
const other = {
	name: "20261002000000_other_issue",
	createdAt: Date.UTC(2026, 9, 2),
	hash: "b".repeat(64),
};
const last = {
	name: "20261003000000_this_issue",
	createdAt: Date.UTC(2026, 9, 3),
	hash: "c".repeat(64),
};
const history = [
	{ ...first, id: 1 },
	{ ...other, id: 2 },
	{ ...last, id: 3 },
] as const;
test("runtime accepts unchanged local migrations interleaved with another issue", () => {
	expect(() =>
		assertRuntimeHistory([first, last], history, true)
	).not.toThrow();
});
test("runtime rejects changed SQL, missing local migrations and invalid unknown identities", () => {
	expect(() =>
		assertRuntimeHistory([first, last], [history[0], history[1]], true)
	).toThrow("Pending");
	expect(() =>
		assertRuntimeHistory(
			[first, last],
			[history[0], history[1], { ...history[2], hash: "changed" }],
			true
		)
	).toThrow("history differs");
	expect(() =>
		assertRuntimeHistory(
			[first, last],
			[history[0], { ...history[1], name: "unknown" }, history[2]],
			true
		)
	).toThrow("identity");
});
