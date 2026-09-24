import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { assetRecords } from "./schema/asset-records";

test("does not cascade Asset Record deletion from its Project or creator", () => {
	const { foreignKeys } = getTableConfig(assetRecords);

	expect(foreignKeys).toHaveLength(2);
	for (const foreignKey of foreignKeys) {
		expect(foreignKey.onDelete).toBe("restrict");
	}
});
