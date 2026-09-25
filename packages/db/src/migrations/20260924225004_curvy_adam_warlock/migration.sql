ALTER TABLE "asset_records" ADD COLUMN IF NOT EXISTS "asset_family_id" text;--> statement-breakpoint
ALTER TABLE "asset_records" ALTER COLUMN "asset_family_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_records" ALTER COLUMN "identity_criteria" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_records"
	DROP CONSTRAINT IF EXISTS "asset_records_identity_criteria_nonempty_check",
	ADD CONSTRAINT "asset_records_identity_criteria_nonempty_check"
	CHECK ("identity_criteria" IS NULL OR cardinality("identity_criteria") >= 1);
