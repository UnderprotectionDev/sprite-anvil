import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
	new URL(
		"./migrations/20260923172332_project-privacy/migration.sql",
		import.meta.url
	),
	"utf8"
);
const assetVersionsMigration = readFileSync(
	new URL(
		"./migrations/20260924232741_fresh_night_nurse/migration.sql",
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

test("preserves existing derivative relationships without invented Asset Versions", () => {
	const addLegacyMarker = assetVersionsMigration.indexOf(
		'ADD COLUMN "legacy_unversioned" boolean DEFAULT false NOT NULL;'
	);
	const markLegacyRelationships = assetVersionsMigration.indexOf(
		'UPDATE "asset_family_relationships" SET "legacy_unversioned" = true WHERE "type" = \'derivative\' AND "source_asset_version_id" IS NULL;'
	);
	const requireVersionForNewDerivatives = assetVersionsMigration.indexOf(
		'ADD CONSTRAINT "asset_family_relationships_derivative_version_check"'
	);

	expect(addLegacyMarker).toBeGreaterThanOrEqual(0);
	expect(markLegacyRelationships).toBeGreaterThan(addLegacyMarker);
	expect(requireVersionForNewDerivatives).toBeGreaterThan(
		markLegacyRelationships
	);
});
