CREATE TABLE "rights_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"source" text,
	"rights_holder_or_provider" text,
	"asserted_scope" text,
	"evidence" text,
	"restrictions" text,
	"uncertainty" text,
	"state" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rights_records_version_number_check" CHECK ("version_number" > 0),
	CONSTRAINT "rights_records_state_check" CHECK ("state" IN ('documented', 'assertion_only', 'unknown', 'restricted')),
	CONSTRAINT "rights_records_state_fields_check" CHECK (("state" <> 'documented' OR ("evidence" IS NOT NULL AND length(trim("evidence")) > 0)) AND ("state" <> 'restricted' OR ("restrictions" IS NOT NULL AND length(trim("restrictions")) > 0)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rights_records_asset_version_idx" ON "rights_records" ("project_id","asset_record_id","version_number");--> statement-breakpoint
CREATE INDEX "rights_records_project_asset_created_idx" ON "rights_records" ("project_id","asset_record_id","created_at");--> statement-breakpoint
ALTER TABLE "rights_records" ADD CONSTRAINT "rights_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "rights_records" ADD CONSTRAINT "rights_records_project_asset_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;