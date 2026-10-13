import { deepStrictEqual, doesNotThrow, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { getMetadataBase } from "./metadata-base";

test("preserves a configured documentation origin and base path", () => {
  strictEqual(
    getMetadataBase("https://docs.example.test/guide/").href,
    "https://docs.example.test/guide/"
  );
});

test("uses the existing local default for missing or malformed configuration", () => {
  const values = [undefined, "", "/docs", "not a URL", "https://[invalid"];
  for (const value of values) {
    doesNotThrow(() => getMetadataBase(value));
    deepStrictEqual(getMetadataBase(value), new URL("http://localhost:4000"));
  }
});
