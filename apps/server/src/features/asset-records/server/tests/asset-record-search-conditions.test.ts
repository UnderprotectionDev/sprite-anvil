import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { getSearchConditions } from "../asset-record-store";

test("searches both current and legacy Turkish tag forms within the project filter", () => {
	const condition = getSearchConditions({} as Database, "owner", {
		projectId: "project",
		tag: "inventory",
	});
	if (!condition) {
		throw new Error("Expected a project-scoped search condition.");
	}
	const query = new PgDialect().sqlToQuery(condition);
	expect(query.sql).toContain("unnest");
	expect(query.params).toContain("inventory");
	expect(query.params).toContain("project");
	expect(query.params).toContain("owner");
});
