import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { rightsRecords } from "./schema/rights-records";

test("Rights Records keep version identity unique and asset deletion restrictive", () => {
	const { checks, foreignKeys, indexes } = getTableConfig(rightsRecords);
	const versionIndex = indexes.find(
		(index) => index.config.name === "rights_records_asset_version_idx"
	);
	const referenceVersionIndex = indexes.find(
		(index) => index.config.name === "rights_records_reference_version_idx"
	);

	expect(versionIndex?.config.unique).toBe(true);
	expect(
		versionIndex?.config.columns.map((column) =>
			"name" in column ? column.name : null
		)
	).toEqual(["project_id", "asset_record_id", "version_number"]);
	expect(referenceVersionIndex?.config.unique).toBe(true);
	expect(
		referenceVersionIndex?.config.columns.map((column) =>
			"name" in column ? column.name : null
		)
	).toEqual([
		"project_id",
		"asset_record_id",
		"reference_id",
		"version_number",
	]);
	expect(
		foreignKeys.some(
			(foreignKey) =>
				foreignKey.getName() === "rights_records_project_asset_record_fk" &&
				foreignKey.onDelete === "restrict"
		)
	).toBe(true);
	expect(
		foreignKeys.some(
			(foreignKey) =>
				foreignKey.getName() === "rights_records_project_asset_reference_fk" &&
				foreignKey.onDelete === "restrict"
		)
	).toBe(true);
	expect(checks.map((check) => check.name)).toEqual(
		expect.arrayContaining([
			"rights_records_version_number_check",
			"rights_records_state_check",
			"rights_records_state_fields_check",
		])
	);
});
