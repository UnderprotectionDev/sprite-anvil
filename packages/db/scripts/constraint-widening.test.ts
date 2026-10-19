import { expect, test } from "bun:test";
import {
	canHoldWhenNull,
	holdsWhenNull,
	isCheckWidening,
} from "./constraint-widening";

test("adding an option to a text CHECK list is widening in source and PostgreSQL forms", () => {
	expect(
		isCheckWidening(`"status" IN ('a', 'b')`, `"status" IN ('a', 'b', 'c')`)
	).toBe(true);
	expect(
		isCheckWidening(
			"CHECK ((status = ANY (ARRAY['a'::text, 'b'::text])))",
			"CHECK ((status = ANY (ARRAY['a'::text, 'b'::text, 'c'::text])))"
		)
	).toBe(true);
	expect(
		isCheckWidening(
			"(records.status = ANY ('{a,b}'::text[]))",
			`(records.status = ANY ('{a,b,"c d"}'::text[]))`
		)
	).toBe(true);
	expect(
		isCheckWidening(
			`"note" IS NULL OR "note" IN ('it''s')`,
			`"note" IS NULL OR "note" IN ('it''s', 'other')`
		)
	).toBe(true);
});

test("removed options, changed structure and negated lists are not widening", () => {
	expect(isCheckWidening(`"status" IN ('a', 'b')`, `"status" IN ('a')`)).toBe(
		false
	);
	expect(
		isCheckWidening(`"status" IN ('a', 'b')`, `"kind" IN ('a', 'b', 'c')`)
	).toBe(false);
	expect(
		isCheckWidening(`"status" NOT IN ('a')`, `"status" NOT IN ('a', 'b')`)
	).toBe(false);
	expect(
		isCheckWidening(
			"(NOT (status = ANY ('{a}'::text[])))",
			"(NOT (status = ANY ('{a,b}'::text[])))"
		)
	).toBe(false);
	expect(isCheckWidening(`"revision" > 0`, `"revision" > 1`)).toBe(false);
});

test("an added OR alternative outside negation is widening", () => {
	const before = `("state" <> 'documented' OR ("evidence" IS NOT NULL AND length(trim("evidence")) > 0)) AND ("state" <> 'restricted' OR "restrictions" IS NOT NULL)`;
	expect(
		isCheckWidening(
			before,
			`("state" <> 'documented' OR ("evidence" IS NOT NULL AND length(trim("evidence")) > 0) OR "evidence_file" IS NOT NULL) AND ("state" <> 'restricted' OR "restrictions" IS NOT NULL)`
		)
	).toBe(true);
	expect(
		isCheckWidening(
			before,
			`("state" <> 'documented' OR ("evidence" IS NOT NULL AND length(trim("evidence")) > 0)) AND ("state" <> 'restricted' OR "restrictions" IS NOT NULL) AND "state" <> 'x'`
		)
	).toBe(false);
	expect(isCheckWidening(`NOT ("a" = 1)`, `NOT ("a" = 1 OR "b" = 2)`)).toBe(
		false
	);
	expect(
		isCheckWidening(
			`"size" BETWEEN 1 AND 5`,
			`"size" BETWEEN 1 AND 5 OR "size" IS NULL`
		)
	).toBe(true);
});

test("a CHECK that cannot fail while new columns are NULL accepts older writes", () => {
	const fresh = new Set(["unit_version_id", "composite_version_id"]);
	expect(
		holdsWhenNull(
			`NOT ("unit_version_id" IS NOT NULL AND "composite_version_id" IS NOT NULL) AND (("unit_version_id" IS NULL AND "composite_version_id" IS NULL) OR "kind" = 'quality')`,
			fresh
		)
	).toBe(true);
	expect(
		holdsWhenNull(
			"CHECK (((NOT ((unit_version_id IS NOT NULL) AND (composite_version_id IS NOT NULL))) AND (((unit_version_id IS NULL) AND (composite_version_id IS NULL)) OR (kind = 'quality'::text))))",
			fresh
		)
	).toBe(true);
	expect(holdsWhenNull(`length(trim("unit_version_id")) > 0`, fresh)).toBe(
		true
	);
	expect(holdsWhenNull(`"kind" = 'quality'`, fresh)).toBe(false);
	expect(
		holdsWhenNull(`"unit_version_id" IS NOT NULL OR "kind" = 'quality'`, fresh)
	).toBe(false);
	expect(holdsWhenNull(`coalesce("unit_version_id", '') <> ''`, fresh)).toBe(
		false
	);
	expect(holdsWhenNull("unparseable (", fresh)).toBe(false);
	expect(canHoldWhenNull(`"unit_version_id" IS NOT NULL`, fresh)).toBe(false);
	expect(canHoldWhenNull(`"kind" = 'quality'`, fresh)).toBe(true);
});

test("defaults bind the older-write evaluation of CHECK expressions", () => {
	// A violating default rejects the CHECK for older writes.
	expect(
		holdsWhenNull(`"rank" >= 0`, new Set(), new Map([["rank", "-1"]]))
	).toBe(false);
	expect(holdsWhenNull(`"rank" > 0`, new Set(), new Map([["rank", "0"]]))).toBe(
		false
	);
	// A satisfying default holds.
	expect(
		holdsWhenNull(`"rank" >= 0`, new Set(), new Map([["rank", "0"]]))
	).toBe(true);
	// Literal lists and string comparisons fold against string defaults.
	expect(
		holdsWhenNull(
			`"state" IN ('draft', 'done')`,
			new Set(),
			new Map([["state", "'draft'"]])
		)
	).toBe(true);
	expect(
		holdsWhenNull(
			`"state" = 'done'`,
			new Set(),
			new Map([["state", "'draft'"]])
		)
	).toBe(false);
	// PostgreSQL forms fold too: casts and ANY(ARRAY) membership.
	expect(
		holdsWhenNull(
			`"state" = ANY (ARRAY['draft'::text, 'done'::text])`,
			new Set(),
			new Map([["state", "'draft'::text"]])
		)
	).toBe(true);
	// Non-constant defaults cannot be proven and reject the CHECK.
	expect(
		holdsWhenNull(
			`"created" > '2000-01-01'`,
			new Set(),
			new Map([["created", "now()"]])
		)
	).toBe(false);
	// NULL columns still dominate: they turn their atoms into NULL (a pass),
	// so only atoms the NULL cannot reach decide the outcome.
	expect(
		holdsWhenNull(
			`"ref" IS NULL OR "rank" >= 0`,
			new Set(["ref"]),
			new Map([["rank", "-1"]])
		)
	).toBe(true);
	expect(
		holdsWhenNull(
			`"ref" IS NOT NULL OR "rank" >= 0`,
			new Set(["ref"]),
			new Map([["rank", "-1"]])
		)
	).toBe(false);
});
