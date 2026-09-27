import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { collectionAssetRecords, collections } from "./schema/collections";

test("keeps Collection membership project-scoped and independent of Asset Families", () => {
	const collectionColumns = getTableConfig(collections).columns.map(
		(column) => column.name
	);
	const membershipConfig = getTableConfig(collectionAssetRecords);
	const membershipColumns = membershipConfig.columns.map(
		(column) => column.name
	);

	expect(collectionColumns).toContain("project_id");
	expect(collectionColumns).toContain("name");
	expect(membershipColumns).toContain("project_id");
	expect(membershipColumns).toContain("collection_id");
	expect(membershipColumns).toContain("asset_record_id");
	expect(membershipColumns).not.toContain("asset_family_id");
	expect(
		membershipConfig.primaryKeys[0]?.columns.map((column) => column.name)
	).toEqual(["project_id", "collection_id", "asset_record_id"]);
	expect(
		membershipConfig.foreignKeys.filter(
			(foreignKey) => foreignKey.onDelete === "cascade"
		)
	).toHaveLength(2);
});
