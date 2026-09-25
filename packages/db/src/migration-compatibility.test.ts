import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function readMigration(path: string) {
	return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = readMigration(
	"./migrations/20260923172332_project-privacy/migration.sql"
);
const assetFamilyMigration = readMigration(
	"./migrations/20260924211159_asset-families/migration.sql"
);
const assetVersionsMigration = readMigration(
	"./migrations/20260924232741_fresh_night_nurse/migration.sql"
);
const assetVersionIntegrityMigration = readMigration(
	"./migrations/20260925112723_asset-version-integrity-idempotency-review-rationale/migration.sql"
);
const assetRecordMigration = readMigration(
	"./migrations/20260924212648_overrated_edwin_jarvis/migration.sql"
);
const assetRecordCompatibilityMigration = readMigration(
	"./migrations/20260924225004_curvy_adam_warlock/migration.sql"
);
const assetTrackingMigration = readMigration(
	"./migrations/20260925085240_past_wasp/migration.sql"
);
const assetTrackingConstraintMigration = readMigration(
	"./migrations/20260925092506_wild_doctor_doom/migration.sql"
);
const assetTrackingRelationshipMigration = readMigration(
	"./migrations/20260925092755_pale_demogoblin/migration.sql"
);
const mergedAssetSchemaMigration = readMigration(
	"./migrations/20260925135634_merge_asset_record_family_contract/migration.sql"
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
	expect(assetFamilyMigration).toContain(
		'CREATE TABLE IF NOT EXISTS "subject_identities"'
	);
	expect(assetFamilyMigration).not.toContain('CREATE TABLE "asset_families"');
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

test("keeps immutable Asset Version migrations linked to family and record lineage", () => {
	expect(assetVersionsMigration).toContain(
		"created by the merged model migration"
	);
	expect(assetVersionIntegrityMigration).toContain(
		"created by the merged model migration"
	);
	for (const table of [
		"asset_family_canonical_designs",
		"asset_family_relationships",
	]) {
		expect(mergedAssetSchemaMigration).toContain(
			`CREATE TABLE IF NOT EXISTS "${table}"`
		);
	}
	expect(mergedAssetSchemaMigration).toContain(
		'FOREIGN KEY ("project_id","asset_family_id","asset_record_id") REFERENCES "asset_records"'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'"legacy_unversioned" boolean DEFAULT false NOT NULL'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'"asset_family_relationships_derivative_version_check" CHECK'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'ADD COLUMN IF NOT EXISTS "integrity_verified" boolean DEFAULT false NOT NULL'
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
		expect(assetTrackingMigration).toContain(
			`CREATE TABLE IF NOT EXISTS "${table}"`
		);
	}
	expect(assetTrackingMigration).toContain(
		'FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"'
	);
	expect(assetTrackingMigration).toContain(
		'FOREIGN KEY ("project_id","target_version_id") REFERENCES "asset_versions"'
	);
});

test("preserves Asset Family history and unknown legacy version metadata during the merge", () => {
	expect(mergedAssetSchemaMigration).toContain(
		'RENAME COLUMN "asset_version_id" TO "version_id"'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'RENAME COLUMN "type" TO "decision"'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'SET "byte_size" = "content_length"'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'SET "sha256" = "content_digest"'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'ALTER COLUMN "file_name" DROP NOT NULL'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'ALTER COLUMN "sha256" DROP NOT NULL'
	);
	expect(mergedAssetSchemaMigration).toContain(
		'UPDATE "asset_families" AS family'
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
