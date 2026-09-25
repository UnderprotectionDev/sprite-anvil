ALTER TABLE "asset_records"
	DROP CONSTRAINT IF EXISTS "asset_records_project_id_project_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_records"
	ADD CONSTRAINT "asset_records_project_id_project_id_fkey"
	FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "asset_records"
	DROP CONSTRAINT IF EXISTS "asset_records_created_by_user_id_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "asset_records"
	ADD CONSTRAINT "asset_records_created_by_user_id_user_id_fkey"
	FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
