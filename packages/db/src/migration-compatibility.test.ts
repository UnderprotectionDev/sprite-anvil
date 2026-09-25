import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
	new URL(
		"./migrations/20260923172332_project-privacy/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetRecordMigration = readFileSync(
	new URL(
		"./migrations/20260924212648_overrated_edwin_jarvis/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetRecordCompatibilityMigration = readFileSync(
	new URL(
		"./migrations/20260924225004_curvy_adam_warlock/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetTrackingMigration = readFileSync(
	new URL(
		"./migrations/20260925085240_past_wasp/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetTrackingConstraintMigration = readFileSync(
	new URL(
		"./migrations/20260925092506_wild_doctor_doom/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetTrackingRelationshipMigration = readFileSync(
	new URL(
		"./migrations/20260925092755_pale_demogoblin/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetDiscoveryMigration = readFileSync(
	new URL(
		"./migrations/20260925114002_romantic_unicorn/migration.sql",
		import.meta.url
	),
	"utf8"
);

test("normalizes legacy project ownership before current indexes and foreign keys", () => {
	const renameOwnerColumn = migration.indexOf(
		'ALTER TABLE "project" RENAME COLUMN "owner_id" TO "owner_user_id";'
	);
	const renameOwnerIndex = migration.indexOf(
		'ALTER INDEX "project_ownerId_idx" RENAME TO "project_ownerUserId_idx";'
	);
	const renameOwnerConstraint = migration.indexOf(
		'RENAME CONSTRAINT "project_owner_id_user_id_fkey"'
	);
	const createOwnerIndex = migration.indexOf(
		'CREATE INDEX IF NOT EXISTS "project_ownerUserId_idx"'
	);
	const createOwnerConstraint = migration.indexOf(
		'ADD CONSTRAINT "project_owner_user_id_user_id_fkey"'
	);

	expect(renameOwnerColumn).toBeGreaterThanOrEqual(0);
	expect(renameOwnerIndex).toBeGreaterThan(renameOwnerColumn);
	expect(renameOwnerConstraint).toBeGreaterThan(renameOwnerIndex);
	expect(createOwnerIndex).toBeGreaterThan(renameOwnerConstraint);
	expect(createOwnerConstraint).toBeGreaterThan(createOwnerIndex);
});

test("extends an existing Asset Family table without recreating its records", () => {
	expect(assetRecordMigration).toContain(
		'CREATE TABLE IF NOT EXISTS "asset_records"'
	);
	expect(assetRecordMigration).toContain(
		'ADD COLUMN IF NOT EXISTS "identity_criteria" text[]'
	);
	expect(assetRecordMigration).toContain(
		"ADD COLUMN IF NOT EXISTS \"availability\" text DEFAULT 'active' NOT NULL"
	);
	expect(assetRecordCompatibilityMigration).toContain(
		'ADD COLUMN IF NOT EXISTS "asset_family_id" text'
	);
	expect(assetRecordCompatibilityMigration).toContain(
		'ALTER COLUMN "asset_family_id" DROP NOT NULL'
	);
});

test("adds immutable Asset Version tracking and its project-scoped relations", () => {
	for (const table of [
		"asset_families",
		"asset_versions",
		"asset_version_review_events",
		"asset_version_quality_evidence",
		"legacy_asset_attestations",
		"asset_record_references",
		"asset_record_derivatives",
	]) {
		expect(assetTrackingMigration).toContain(`CREATE TABLE "${table}"`);
	}
	expect(assetTrackingMigration).toContain(
		'FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"'
	);
	expect(assetTrackingMigration).toContain(
		'FOREIGN KEY ("project_id","target_version_id") REFERENCES "asset_versions"'
	);
});

test("keeps family names unique and derivative family membership project-scoped", () => {
	expect(assetTrackingConstraintMigration).toContain(
		'CREATE UNIQUE INDEX "asset_families_project_name_ci_idx" ON "asset_families" ("project_id",lower("name"))'
	);
	expect(assetTrackingConstraintMigration).toContain(
		'FOREIGN KEY ("project_id","derivative_asset_record_id","asset_family_id") REFERENCES "asset_records"("project_id","id","asset_family_id")'
	);
	expect(assetTrackingConstraintMigration).toContain(
		'CREATE UNIQUE INDEX "asset_record_derivatives_source_target_idx"'
	);
});

test("pins canonical family versions and keeps review and quality evidence consistent", () => {
	expect(assetTrackingRelationshipMigration).toContain(
		'FOREIGN KEY ("project_id","asset_family_id","canonical_version_id") REFERENCES "asset_families"("project_id","id","canonical_version_id")'
	);
	expect(assetTrackingRelationshipMigration).toContain(
		'FOREIGN KEY ("project_id","version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id")'
	);
	expect(assetTrackingRelationshipMigration).toContain(
		'CHECK (NOT ("transferred_features" && "forbidden_features"))'
	);
});

test("adds Asset Record metadata and immutable source image measurements", () => {
	for (const column of [
		"asset_category",
		"visual_world_id",
		"theme_id",
		"tags",
	]) {
		expect(assetDiscoveryMigration).toContain(`ADD COLUMN "${column}"`);
	}
	for (const column of ["source_image_width", "source_image_height"]) {
		expect(assetDiscoveryMigration).toContain(`ADD COLUMN "${column}" integer`);
	}
	expect(assetDiscoveryMigration).toContain(
		'FOREIGN KEY ("project_id","visual_world_id","theme_id") REFERENCES "themes"'
	);
	expect(assetDiscoveryMigration).toContain(
		'CREATE INDEX "asset_versions_project_source_image_dimensions_idx"'
	);
});
