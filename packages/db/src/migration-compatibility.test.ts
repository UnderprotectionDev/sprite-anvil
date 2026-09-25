import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

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
const legacyAssetSchemaBridgeMigration = readMigration(
	"./migrations/20260925080000_legacy_asset_schema_bridge/migration.sql"
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
const assetDiscoveryMigration = readMigration(
	"./migrations/20260925114002_romantic_unicorn/migration.sql"
);
const assetRecordForeignKeyRestoreMigration = readFileSync(
	new URL(
		"./migrations/20260925160000_asset_record_foreign_key_restore/migration.sql",
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
		'CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_name_ci_idx" ON "asset_families" ("project_id",lower("name"))'
	);
	expect(assetTrackingConstraintMigration).toContain(
		'FOREIGN KEY ("project_id","derivative_asset_record_id","asset_family_id") REFERENCES "asset_records"("project_id","id","asset_family_id")'
	);
	expect(assetTrackingConstraintMigration).toContain(
		'CREATE UNIQUE INDEX IF NOT EXISTS "asset_record_derivatives_source_target_idx"'
	);
});

test("bridges legacy Asset Version metadata without inventing unavailable values", () => {
	expect(legacyAssetSchemaBridgeMigration).toContain(
		'RENAME COLUMN "content_length" TO "byte_size"'
	);
	expect(legacyAssetSchemaBridgeMigration).toContain(
		'ADD COLUMN IF NOT EXISTS "file_name" text'
	);
	expect(legacyAssetSchemaBridgeMigration).toContain(
		'ADD COLUMN IF NOT EXISTS "sha256" text'
	);
	expect(legacyAssetSchemaBridgeMigration).toContain(
		"refusing ambiguous migration"
	);
});

test("restores project and creator foreign keys removed by the legacy bridge", () => {
	for (const constraint of [
		"asset_families_project_visual_world_fk",
		"asset_families_created_by_user_id_user_id_fkey",
		"asset_versions_created_by_user_id_user_id_fkey",
		"asset_version_review_events_created_by_user_id_user_id_fkey",
	]) {
		expect(assetRecordForeignKeyRestoreMigration).toContain(
			`ADD CONSTRAINT "${constraint}"`
		);
	}
	expect(assetRecordForeignKeyRestoreMigration).toContain(
		'FOREIGN KEY ("project_id","visual_world_id")'
	);
	expect(assetRecordForeignKeyRestoreMigration).toContain(
		'REFERENCES "visual_worlds"("project_id","id") ON DELETE RESTRICT'
	);
	expect(assetRecordForeignKeyRestoreMigration).toContain(
		'FOREIGN KEY ("created_by_user_id")'
	);
	expect(assetRecordForeignKeyRestoreMigration).toContain(
		'REFERENCES "user"("id") ON DELETE RESTRICT'
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
		expect(assetDiscoveryMigration).toContain(
			`ADD COLUMN IF NOT EXISTS "${column}"`
		);
	}
	for (const column of ["source_image_width", "source_image_height"]) {
		expect(assetDiscoveryMigration).toContain(
			`ADD COLUMN IF NOT EXISTS "${column}" integer`
		);
	}
	expect(assetDiscoveryMigration).toContain(
		'FOREIGN KEY ("project_id","visual_world_id","theme_id") REFERENCES "themes"'
	);
	expect(assetDiscoveryMigration).toContain(
		'CREATE INDEX IF NOT EXISTS "asset_versions_project_source_image_dimensions_idx"'
	);
});

test("reapplies Asset Record metadata and source measurements after newer legacy migrations", () => {
	const migrationsDirectory = new URL("./migrations/", import.meta.url);
	const forwardCompatibilityDirectory = readdirSync(migrationsDirectory).find(
		(directory) =>
			directory.endsWith("_asset_record_search_schema_compatibility")
	);

	expect(forwardCompatibilityDirectory).toBeDefined();
	if (!forwardCompatibilityDirectory) {
		return;
	}

	const forwardCompatibilityMigration = readFileSync(
		new URL(
			`./migrations/${forwardCompatibilityDirectory}/migration.sql`,
			import.meta.url
		),
		"utf8"
	);

	for (const column of [
		"asset_category",
		"visual_world_id",
		"theme_id",
		"tags",
	]) {
		expect(forwardCompatibilityMigration).toContain(
			`ADD COLUMN IF NOT EXISTS "${column}"`
		);
	}
	for (const column of ["source_image_width", "source_image_height"]) {
		expect(forwardCompatibilityMigration).toContain(
			`ADD COLUMN IF NOT EXISTS "${column}" integer`
		);
	}
	expect(forwardCompatibilityMigration).toContain(
		'CREATE INDEX IF NOT EXISTS "asset_versions_project_source_image_dimensions_idx"'
	);
});

test("reconciles Drizzle snapshot parents and preserves both asset schema branches", () => {
	const migrationsDirectory = new URL("./migrations/", import.meta.url);
	const reconciliationDirectory =
		"20260925211335_asset_record_search_history_reconciliation";
	const reconciliationSnapshot = JSON.parse(
		readFileSync(
			new URL(
				`./migrations/${reconciliationDirectory}/snapshot.json`,
				import.meta.url
			),
			"utf8"
		)
	) as {
		ddl: Record<string, unknown>[];
		prevIds: string[];
	};
	const snapshotsById = new Map<string, string>();
	for (const directory of readdirSync(migrationsDirectory, {
		withFileTypes: true,
	})) {
		if (!directory.isDirectory()) {
			continue;
		}
		const path = new URL(
			`./migrations/${directory.name}/snapshot.json`,
			import.meta.url
		);
		if (!existsSync(path)) {
			continue;
		}
		const snapshot = JSON.parse(readFileSync(path, "utf8")) as { id: string };
		snapshotsById.set(snapshot.id, directory.name);
	}

	expect(reconciliationSnapshot.prevIds).toEqual([
		"6cab86ff-760d-4fe6-8794-f61c7f39a039",
		"3a716c06-aa45-4c0b-a7f2-b004f3ecf0fb",
		"32f864e4-e70c-4a1b-ba17-abfa1f86699f",
	]);
	for (const parentId of reconciliationSnapshot.prevIds) {
		expect(snapshotsById.has(parentId)).toBe(true);
	}
	for (const table of [
		"asset_records",
		"asset_record_measurements",
		"asset_versions",
	]) {
		expect(reconciliationSnapshot.ddl).toContainEqual(
			expect.objectContaining({
				entityType: "tables",
				name: table,
				schema: "public",
			})
		);
	}
	for (const [table, name] of [
		["asset_records", "asset_category"],
		["asset_records", "tags"],
		["asset_versions", "source_image_width"],
		["asset_versions", "source_image_height"],
	] as const) {
		expect(reconciliationSnapshot.ddl).toContainEqual(
			expect.objectContaining({
				entityType: "columns",
				name,
				schema: "public",
				table,
			})
		);
	}
});
