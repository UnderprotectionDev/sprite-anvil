CREATE TABLE "gameplay_metadata_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gameplay_metadata_records_target_idx" ON "gameplay_metadata_records" ("project_id","asset_record_id","created_at");--> statement-breakpoint
ALTER TABLE "gameplay_metadata_records" ADD CONSTRAINT "gameplay_metadata_records_GJpnJZOL374A_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gameplay_metadata_records" ADD CONSTRAINT "gameplay_metadata_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "gameplay_metadata_records" ADD CONSTRAINT "gameplay_metadata_records_exact_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;