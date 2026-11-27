CREATE TABLE "colour_merges" (
	"asset_version_id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"source_asset_version_id" text NOT NULL,
	"context_revision_id" text NOT NULL,
	"steps" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_rule_measurements" (
	"project_id" text NOT NULL,
	"asset_version_id" text,
	"measurement_version" text,
	"content_digest" text NOT NULL,
	"colours" jsonb NOT NULL,
	"outline_width" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "context_rule_measurements_pk" PRIMARY KEY("asset_version_id","measurement_version")
);
--> statement-breakpoint
CREATE INDEX "colour_merges_project_idx" ON "colour_merges" ("project_id");--> statement-breakpoint
CREATE INDEX "context_rule_measurements_project_idx" ON "context_rule_measurements" ("project_id");--> statement-breakpoint
ALTER TABLE "colour_merges" ADD CONSTRAINT "colour_merges_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "colour_merges" ADD CONSTRAINT "colour_merges_version_fk" FOREIGN KEY ("project_id","asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "colour_merges" ADD CONSTRAINT "colour_merges_source_version_fk" FOREIGN KEY ("project_id","source_asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "colour_merges" ADD CONSTRAINT "colour_merges_context_revision_fk" FOREIGN KEY ("project_id","context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "context_rule_measurements" ADD CONSTRAINT "context_rule_measurements_version_fk" FOREIGN KEY ("project_id","asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE CASCADE;