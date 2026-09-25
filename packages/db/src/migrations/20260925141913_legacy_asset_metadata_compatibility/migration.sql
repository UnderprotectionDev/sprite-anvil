ALTER TABLE "asset_families" ALTER COLUMN "canonical_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "file_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "sha256" DROP NOT NULL;