import { expect, test } from "bun:test";
import { recordContentDigest } from "./record-content-digest";

test("digests the same content identically regardless of key order", async () => {
	expect(await recordContentDigest({ a: 1, b: { c: [1, 2], d: "x" } })).toBe(
		await recordContentDigest({ b: { d: "x", c: [1, 2] }, a: 1 })
	);
});

test("matches a known SHA-256 of the canonical JSON text", async () => {
	// sha256 of the text {"a":1,"b":[true,null]}
	expect(await recordContentDigest({ b: [true, null], a: 1 })).toBe(
		"1cc69c7fa23616ca2ec3ee70d24390a6225c8832db8a4c814c7e0e7f942f8668"
	);
});

test("changes when any value changes and ignores undefined members", async () => {
	const base = await recordContentDigest({ a: 1, b: [1, 2] });
	expect(await recordContentDigest({ a: 1, b: [2, 1] })).not.toBe(base);
	expect(await recordContentDigest({ a: 1, b: [1, 2], c: undefined })).toBe(
		base
	);
});
