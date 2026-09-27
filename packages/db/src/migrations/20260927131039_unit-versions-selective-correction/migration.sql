CREATE TABLE "unit_versions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"source_asset_version_id" text NOT NULL,
	"unit_type" text NOT NULL,
	"unit_key" text NOT NULL,
	"version_number" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unit_versions_type_check" CHECK ("unit_type" IN ('frame', 'direction', 'tile', 'state')),
	CONSTRAINT "unit_versions_key_check" CHECK ("unit_key" = btrim("unit_key") AND char_length("unit_key") BETWEEN 1 AND 120),
	CONSTRAINT "unit_versions_version_number_check" CHECK ("version_number" > 0),
	CONSTRAINT "unit_versions_source_distinct_check" CHECK ("asset_version_id" <> "source_asset_version_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unit_versions_project_asset_version_idx" ON "unit_versions" ("project_id","asset_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_versions_identity_version_idx" ON "unit_versions" ("project_id","asset_record_id","unit_type","unit_key","version_number");--> statement-breakpoint
CREATE INDEX "unit_versions_identity_created_at_idx" ON "unit_versions" ("project_id","asset_record_id","unit_type","unit_key","created_at");--> statement-breakpoint
ALTER TABLE "unit_versions" ADD CONSTRAINT "unit_versions_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_versions" ADD CONSTRAINT "unit_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_versions" ADD CONSTRAINT "unit_versions_candidate_asset_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_versions" ADD CONSTRAINT "unit_versions_source_asset_version_fk" FOREIGN KEY ("project_id","source_asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;
