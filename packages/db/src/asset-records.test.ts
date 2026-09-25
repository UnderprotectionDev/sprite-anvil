import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { legacyAssetAttestations } from "./schema/asset-production-history";
import { assetRecordDerivatives } from "./schema/asset-record-derivatives";
import { assetRecordReferences } from "./schema/asset-record-references";
import { assetRecords } from "./schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "./schema/asset-versions";

test("keeps Asset Record project, family, and context scope relations restrictive", () => {
	const { foreignKeys } = getTableConfig(assetRecords);

	expect(foreignKeys).toHaveLength(5);
	for (const foreignKey of foreignKeys) {
		expect(foreignKey.onDelete).toBe("restrict");
	}
});

test("allows Asset Records to exist without an Asset Family or legacy criteria", () => {
	const { columns } = getTableConfig(assetRecords);
	const assetFamilyId = columns.find(
		(column) => column.name === "asset_family_id"
	);
	const identityCriteria = columns.find(
		(column) => column.name === "identity_criteria"
	);

	expect(assetFamilyId?.notNull).toBe(false);
	expect(identityCriteria?.notNull).toBe(false);
});

test("keeps version and tracking history linked with restrictive project-scoped references", () => {
	for (const table of [
		assetVersions,
		assetVersionReviewEvents,
		assetVersionQualityEvidence,
		legacyAssetAttestations,
		assetRecordReferences,
		assetRecordDerivatives,
	]) {
		const { foreignKeys } = getTableConfig(table);
		expect(foreignKeys.length).toBeGreaterThan(0);
		for (const foreignKey of foreignKeys) {
			expect(foreignKey.onDelete).toBe("restrict");
		}
	}
});
