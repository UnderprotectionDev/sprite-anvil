import { expect, test } from "bun:test";
import { classifyDevelopmentHistory } from "./development-history";
import {
	type AppliedMigration,
	assertMigrationHistory,
	type LocalMigration,
} from "./migration-policy";

const migration = (stamp: string, slug: string, hash: string) => ({
	name: `${stamp}_${slug}`,
	createdAt: Date.UTC(
		Number(stamp.slice(0, 4)),
		Number(stamp.slice(4, 6)) - 1,
		Number(stamp.slice(6, 8)),
		Number(stamp.slice(8, 10)),
		Number(stamp.slice(10, 12)),
		Number(stamp.slice(12, 14))
	),
	hash: hash.repeat(64),
});
const first = migration("20261001000000", "first", "a");
const own = migration("20261002000000", "own_issue", "b");
const other = migration("20261003000000", "other_issue", "c");
const rows = (...migrations: LocalMigration[]): AppliedMigration[] =>
	migrations.map((entry, index) => ({ ...entry, id: index + 1 }));

test("records from other branches are accepted and reported as foreign", () => {
	const history = classifyDevelopmentHistory(
		[first, own],
		rows(first, other, own),
		true
	);
	expect(history.pending).toEqual([]);
	expect(history.foreign.map((row) => row.name)).toEqual([other.name]);
});

test("an older local migration behind a newer foreign record is pending", () => {
	const history = classifyDevelopmentHistory(
		[first, own],
		rows(first, other),
		true
	);
	expect(history.pending).toEqual([own]);
	expect(history.foreign.map((row) => row.name)).toEqual([other.name]);
});

test("a rebased migration with the same SQL is recognized by hash", () => {
	const rebased = { ...own, ...migration("20261004000000", "own_issue", "b") };
	const history = classifyDevelopmentHistory(
		[first, other, rebased],
		rows(first, own, other),
		true
	);
	expect(history.pending).toEqual([]);
	expect(history.foreign).toEqual([]);
	expect(history.rebased).toEqual([rebased]);
});

test("changed SQL of an applied migration is rejected by name or timestamp", () => {
	expect(() =>
		classifyDevelopmentHistory(
			[first, { ...own, hash: "d".repeat(64) }],
			rows(first, own),
			true
		)
	).toThrow("history differs");
	expect(() =>
		classifyDevelopmentHistory(
			[first, { ...own, name: "20261002000000_renamed", hash: "d".repeat(64) }],
			rows(first, own),
			true
		)
	).toThrow(own.name);
});

test("invalid records, untracked tables and invalid local order are rejected", () => {
	expect(() => classifyDevelopmentHistory([first], [], true)).toThrow(
		"without migration history"
	);
	expect(() =>
		classifyDevelopmentHistory(
			[first],
			[...rows(first), { ...other, id: 2, name: "unknown" }],
			true
		)
	).toThrow("identity");
	expect(() =>
		classifyDevelopmentHistory(
			[first],
			[...rows(first), { ...other, id: 2, hash: "future" }],
			true
		)
	).toThrow("identity");
	expect(() =>
		classifyDevelopmentHistory([first], [{ ...first, id: 0 }], true)
	).toThrow("identity");
	expect(() =>
		classifyDevelopmentHistory([own, first], rows(first), true)
	).toThrow("order");
	expect(classifyDevelopmentHistory([first], [], false).pending).toEqual([
		first,
	]);
});

test("production keeps exact order where development accepts hash identity", () => {
	const rebased = { ...own, ...migration("20261004000000", "own_issue", "b") };
	expect(() =>
		assertMigrationHistory([first, own], rows(first, other, own), true)
	).toThrow();
	expect(() =>
		assertMigrationHistory([first, own], rows(first, other), true)
	).toThrow();
	expect(() =>
		assertMigrationHistory(
			[first, other, rebased],
			rows(first, own, other),
			true
		)
	).toThrow();
	expect(() =>
		assertMigrationHistory([first, own, other], rows(first, own), true)
	).not.toThrow();
});
