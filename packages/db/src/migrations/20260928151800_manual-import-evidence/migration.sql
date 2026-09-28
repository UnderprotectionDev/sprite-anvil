CREATE TABLE "manual_import_evidence" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_id" text NOT NULL,
	"generation_package_id" text NOT NULL,
	"source_surface" text NOT NULL,
	"generation_instruction" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_import_evidence_source_surface_check" CHECK ("source_surface" = btrim("source_surface") AND char_length("source_surface") BETWEEN 1 AND 255),
	CONSTRAINT "manual_import_evidence_generation_instruction_check" CHECK (char_length("generation_instruction") BETWEEN 1 AND 100000 AND char_length(btrim("generation_instruction")) > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "source_kind" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_import_evidence_project_version_idx" ON "manual_import_evidence" ("project_id","version_id");--> statement-breakpoint
CREATE INDEX "manual_import_evidence_project_record_created_idx" ON "manual_import_evidence" ("project_id","asset_record_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_packages_project_record_id_idx" ON "generation_packages" ("project_id","asset_record_id","id");--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_version_fk" FOREIGN KEY ("project_id","version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "manual_import_evidence" ADD CONSTRAINT "manual_import_evidence_generation_package_fk" FOREIGN KEY ("project_id","asset_record_id","generation_package_id") REFERENCES "generation_packages"("project_id","asset_record_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_kind_check" CHECK ("source_kind" IN ('unknown', 'legacy_asset', 'manual_import', 'derived'));