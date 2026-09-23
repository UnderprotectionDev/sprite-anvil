import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
	new URL(
		"./migrations/20260923172332_project-privacy/migration.sql",
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
