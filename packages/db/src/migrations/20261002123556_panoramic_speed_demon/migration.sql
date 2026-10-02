CREATE TABLE "derivative_revalidation_reviews" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"context_revision_id" text NOT NULL,
	"canonical_design_version_id" text NOT NULL,
	"change_impact_ids" jsonb NOT NULL,
	CONSTRAINT "derivative_reviews_impacts_check" CHECK (jsonb_typeof("change_impact_ids") = 'array' AND jsonb_array_length("change_impact_ids") > 0)
);
--> statement-breakpoint
CREATE INDEX "derivative_reviews_project_version_idx" ON "derivative_revalidation_reviews" ("project_id","asset_version_id");--> statement-breakpoint
ALTER TABLE "derivative_revalidation_reviews" ADD CONSTRAINT "derivative_revalidation_reviews_Eka18Txqz2QH_fkey" FOREIGN KEY ("id") REFERENCES "asset_version_review_events"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "derivative_revalidation_reviews" ADD CONSTRAINT "derivative_reviews_version_fk" FOREIGN KEY ("project_id","asset_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "derivative_revalidation_reviews" ADD CONSTRAINT "derivative_reviews_context_fk" FOREIGN KEY ("project_id","context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "derivative_revalidation_reviews" ADD CONSTRAINT "derivative_reviews_canonical_fk" FOREIGN KEY ("project_id","canonical_design_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;