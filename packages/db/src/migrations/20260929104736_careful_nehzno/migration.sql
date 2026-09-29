ALTER TABLE "rights_records" ADD COLUMN "reference_id" text;--> statement-breakpoint
DROP INDEX "rights_records_asset_version_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "rights_records_asset_version_idx" ON "rights_records" ("project_id","asset_record_id","version_number") WHERE "reference_id" IS NULL;--> statement-breakpoint
DROP INDEX "rights_records_project_asset_created_idx";--> statement-breakpoint
CREATE INDEX "rights_records_project_asset_created_idx" ON "rights_records" ("project_id","asset_record_id","reference_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rights_records_reference_version_idx" ON "rights_records" ("project_id","asset_record_id","reference_id","version_number") WHERE "reference_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "rights_records" ADD CONSTRAINT "rights_records_project_asset_reference_fk" FOREIGN KEY ("project_id","asset_record_id","reference_id") REFERENCES "reference_board_images"("project_id","asset_record_id","id") ON DELETE RESTRICT;