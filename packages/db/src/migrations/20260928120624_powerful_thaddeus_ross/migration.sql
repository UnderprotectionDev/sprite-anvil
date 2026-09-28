CREATE TABLE "provider_generation_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"provider" text NOT NULL,
	"interface" text,
	"model" text,
	"model_version" text,
	"requested_width" integer,
	"requested_height" integer,
	"actual_width" integer,
	"actual_height" integer,
	"reference_ids" jsonb NOT NULL,
	"palette" jsonb NOT NULL,
	"seed" jsonb,
	"parameter_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_generation_records_requested_dimensions_check" CHECK (("requested_width" IS NULL AND "requested_height" IS NULL) OR ("requested_width" IS NOT NULL AND "requested_height" IS NOT NULL AND "requested_width" > 0 AND "requested_height" > 0)),
	CONSTRAINT "provider_generation_records_actual_dimensions_check" CHECK (("actual_width" IS NULL AND "actual_height" IS NULL) OR ("actual_width" IS NOT NULL AND "actual_height" IS NOT NULL AND "actual_width" > 0 AND "actual_height" > 0))
);
--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "production_source" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_generation_records_version_idx" ON "provider_generation_records" ("project_id","asset_version_id");--> statement-breakpoint
CREATE INDEX "provider_generation_records_project_created_at_idx" ON "provider_generation_records" ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "provider_generation_records" ADD CONSTRAINT "provider_generation_records_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_generation_records" ADD CONSTRAINT "provider_generation_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_generation_records" ADD CONSTRAINT "provider_generation_records_asset_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_production_source_check" CHECK ("production_source" IN ('unknown', 'connected_provider'));