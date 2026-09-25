import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { legacyAssetAttestations } from "./schema/asset-production-history";
import { assetRecordDerivatives } from "./schema/asset-record-derivatives";
import { assetRecordMeasurements } from "./schema/asset-record-measurements";
import { assetRecordReferences } from "./schema/asset-record-references";
import { assetFamilies, assetRecords } from "./schema/asset-records";
import {
	assetVersionQualityEvidence,
	assetVersionReviewEvents,
	assetVersions,
} from "./schema/asset-versions";

test("does not cascade Asset Record deletion from its Project, creator, or family", () => {
	const { foreignKeys } = getTableConfig(assetRecords);

	expect(foreignKeys).toHaveLength(3);
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

test("keeps Asset Record measurements project-scoped and out of implicit deletion", () => {
	const { columns, foreignKeys } = getTableConfig(assetRecordMeasurements);
	const measurements = columns.find((column) => column.name === "measurements");

	expect(measurements?.notNull).toBe(true);
	expect(foreignKeys).toHaveLength(1);
	expect(foreignKeys[0]?.onDelete).toBe("restrict");
});

test("keeps Subject Identity and Canonical Design optional for legacy families", () => {
	const { columns } = getTableConfig(assetFamilies);
	const subjectIdentityId = columns.find(
		(column) => column.name === "subject_identity_id"
	);
	const canonicalVersionId = columns.find(
		(column) => column.name === "canonical_version_id"
	);

	expect(subjectIdentityId?.notNull).toBe(false);
	expect(canonicalVersionId?.notNull).toBe(false);
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
