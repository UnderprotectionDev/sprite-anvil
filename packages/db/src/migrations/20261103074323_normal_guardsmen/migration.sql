CREATE TABLE "pixel_editor_drafts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"source_asset_version_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"operations" jsonb NOT NULL,
	"applied_operation_count" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"committed_asset_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pixel_editor_drafts_status_check" CHECK ("status" IN ('open', 'committed', 'discarded')),
	CONSTRAINT "pixel_editor_drafts_history_check" CHECK ("revision" >= 0 AND "applied_operation_count" >= 0 AND "applied_operation_count" <= jsonb_array_length("operations")),
	CONSTRAINT "pixel_editor_drafts_commit_check" CHECK (("status" = 'committed') = ("committed_asset_version_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pixel_editor_drafts_open_source_idx" ON "pixel_editor_drafts" ("project_id","owner_user_id","source_asset_version_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "pixel_editor_drafts_committed_version_idx" ON "pixel_editor_drafts" ("project_id","committed_asset_version_id") WHERE "committed_asset_version_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pixel_editor_drafts_owner_idx" ON "pixel_editor_drafts" ("project_id","owner_user_id","updated_at");--> statement-breakpoint
ALTER TABLE "pixel_editor_drafts" ADD CONSTRAINT "pixel_editor_drafts_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pixel_editor_drafts" ADD CONSTRAINT "pixel_editor_drafts_source_version_fk" FOREIGN KEY ("project_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pixel_editor_drafts" ADD CONSTRAINT "pixel_editor_drafts_committed_version_fk" FOREIGN KEY ("project_id","committed_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE CASCADE;