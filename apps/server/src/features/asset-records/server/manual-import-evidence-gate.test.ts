import { expect, test } from "bun:test";
import { isManualImportEvidenceRequired } from "./manual-import-evidence-gate";

test("requires evidence for manual imports but does not infer legacy provenance", () => {
	expect(isManualImportEvidenceRequired("manual_import")).toBe(true);
	expect(isManualImportEvidenceRequired("legacy_asset")).toBe(false);
	expect(isManualImportEvidenceRequired("derived")).toBe(false);
});
