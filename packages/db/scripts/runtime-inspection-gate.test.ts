import { expect, test } from "bun:test";
import { createInspectionGate } from "./runtime-inspection-gate";

test("allows the first inspection, then at most one per interval", () => {
	let now = 1000;
	const due = createInspectionGate(30_000, () => now);
	expect(due()).toBe(true);
	now += 1000;
	expect(due()).toBe(false);
	now += 28_999;
	expect(due()).toBe(false);
	now += 1;
	expect(due()).toBe(true);
	now += 1000;
	expect(due()).toBe(false);
});
