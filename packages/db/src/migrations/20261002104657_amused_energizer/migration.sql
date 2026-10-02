CREATE TABLE "change_impacts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"source_asset_version_id" text,
	"source_context_revision_id" text,
	"facets" jsonb NOT NULL,
	"affected_versions" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "change_impacts_single_source_check" CHECK (("source_asset_version_id" IS NOT NULL) <> ("source_context_revision_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "dependency_links" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"source_asset_version_id" text,
	"source_context_revision_id" text,
	"target_asset_version_id" text NOT NULL,
	"facets" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dependency_links_single_source_check" CHECK (("source_asset_version_id" IS NOT NULL) <> ("source_context_revision_id" IS NOT NULL)),
	CONSTRAINT "dependency_links_distinct_versions_check" CHECK ("source_asset_version_id" IS NULL OR "source_asset_version_id" <> "target_asset_version_id")
);
--> statement-breakpoint
CREATE INDEX "change_impacts_project_created_idx" ON "change_impacts" ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dependency_links_version_target_idx" ON "dependency_links" ("project_id","source_asset_version_id","target_asset_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dependency_links_context_target_idx" ON "dependency_links" ("project_id","source_context_revision_id","target_asset_version_id");--> statement-breakpoint
CREATE INDEX "dependency_links_project_idx" ON "dependency_links" ("project_id");--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_source_version_fk" FOREIGN KEY ("project_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "change_impacts" ADD CONSTRAINT "change_impacts_source_context_fk" FOREIGN KEY ("project_id","source_context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dependency_links" ADD CONSTRAINT "dependency_links_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dependency_links" ADD CONSTRAINT "dependency_links_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dependency_links" ADD CONSTRAINT "dependency_links_source_version_fk" FOREIGN KEY ("project_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dependency_links" ADD CONSTRAINT "dependency_links_source_context_fk" FOREIGN KEY ("project_id","source_context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dependency_links" ADD CONSTRAINT "dependency_links_target_version_fk" FOREIGN KEY ("project_id","target_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;