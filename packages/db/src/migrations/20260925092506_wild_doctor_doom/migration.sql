DROP INDEX IF EXISTS "asset_families_project_name_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "asset_families_project_name_ci_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_name_ci_idx" ON "asset_families" ("project_id",lower("name"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_id_family_idx" ON "asset_records" ("project_id","id","asset_family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_record_derivatives_source_target_idx" ON "asset_record_derivatives" ("project_id","source_asset_record_id","derivative_asset_record_id");
--> statement-breakpoint
ALTER TABLE "asset_record_derivatives"
	DROP CONSTRAINT IF EXISTS "asset_record_derivatives_source_fk",
	ADD CONSTRAINT "asset_record_derivatives_source_fk"
		FOREIGN KEY ("project_id","source_asset_record_id","asset_family_id")
		REFERENCES "asset_records"("project_id","id","asset_family_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "asset_record_derivatives"
	DROP CONSTRAINT IF EXISTS "asset_record_derivatives_target_fk",
	ADD CONSTRAINT "asset_record_derivatives_target_fk"
		FOREIGN KEY ("project_id","derivative_asset_record_id","asset_family_id")
		REFERENCES "asset_records"("project_id","id","asset_family_id") ON DELETE RESTRICT;
