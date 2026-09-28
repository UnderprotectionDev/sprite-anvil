CREATE TABLE "source_metadata_mapping_finalizations" (
	"proposal_id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"asset_version_id" text,
	"decisions" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_finalizations" ADD CONSTRAINT "source_metadata_mapping_finalizations_Sk3GecJJ1IXu_fkey" FOREIGN KEY ("proposal_id") REFERENCES "source_metadata_mapping_proposals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_finalizations" ADD CONSTRAINT "source_metadata_mapping_finalizations_uB1NB3dt1j4Q_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_finalizations" ADD CONSTRAINT "source_metadata_mapping_finalizations_VMiF4ZreCuS9_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_finalizations" ADD CONSTRAINT "source_metadata_mapping_finalizations_target_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "source_metadata_mapping_finalizations" ADD CONSTRAINT "source_metadata_mapping_finalizations_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;