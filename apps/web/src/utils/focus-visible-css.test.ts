import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { minimumFocusThickness } from "./focus-indicator";

const outlineWidthPattern = /outline:\s*(\d+(?:\.\d+)?)px solid/;
const css = readFileSync(
	new URL("../index.css", import.meta.url),
	"utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of rules that sit at the top level, outside any `@layer` block. */
function topLevelRules(source: string) {
	const rules: { declarations: string; selector: string }[] = [];
	let depth = 0;
	let buffer = "";
	let selector = "";
	for (const char of source) {
		if (char === "{") {
			if (depth === 0) {
				selector = buffer.trim();
			}
			depth += 1;
			buffer = depth === 1 ? "" : `${buffer}${char}`;
		} else if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				rules.push({ selector, declarations: buffer });
				buffer = "";
			} else {
				buffer += char;
			}
		} else {
			buffer += char;
		}
	}
	return rules;
}

test("the focus-visible rule is unlayered so primitive outline-none and ring-1 utilities cannot override it", () => {
	const rule = topLevelRules(css).find(
		({ selector }) => selector === ":focus-visible"
	);
	expect(rule, ":focus-visible must sit outside every @layer").toBeDefined();
	const width = rule?.declarations.match(outlineWidthPattern);
	expect(Number(width?.[1])).toBeGreaterThanOrEqual(minimumFocusThickness);
});
