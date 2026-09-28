CREATE TABLE "source_metadata_mapping_proposals" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"source_entry_id" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_metadata_mapping_proposals_source_created_at_idx" ON "source_metadata_mapping_proposals" ("project_id","source_entry_id","created_at");--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_proposals" ADD CONSTRAINT "source_metadata_mapping_proposals_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_proposals" ADD CONSTRAINT "source_metadata_mapping_proposals_3O8JdfMGKV6f_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "import_inbox_entries"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_proposals" ADD CONSTRAINT "source_metadata_mapping_proposals_ck9pkd0cooe9_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;