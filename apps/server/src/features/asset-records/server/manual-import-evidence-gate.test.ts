import { expect, test } from "bun:test";
import { isManualImportEvidenceRequired } from "./manual-import-evidence-gate";

const generationPackageCreatedAt = "2026-09-28T09:00:00.000Z";

test("requires evidence for manual imports and legacy results created after a package", () => {
	expect(
		isManualImportEvidenceRequired(
			"manual_import",
			"2026-09-28T08:00:00.000Z",
			[]
		)
	).toBe(true);
	expect(
		isManualImportEvidenceRequired("legacy_asset", "2026-09-28T08:59:59.000Z", [
			generationPackageCreatedAt,
		])
	).toBe(false);
	expect(
		isManualImportEvidenceRequired("legacy_asset", generationPackageCreatedAt, [
			generationPackageCreatedAt,
		])
	).toBe(true);
	expect(
		isManualImportEvidenceRequired("legacy_asset", "2026-09-28T09:00:01.000Z", [
			generationPackageCreatedAt,
		])
	).toBe(true);
	expect(
		isManualImportEvidenceRequired("derived", "2026-09-28T09:01:00.000Z", [
			generationPackageCreatedAt,
		])
	).toBe(false);
});
