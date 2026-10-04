CREATE TABLE "directional_reviews" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"canonical_design_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "directional_reviews_family_idx" ON "directional_reviews" ("project_id","asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "directional_reviews" ADD CONSTRAINT "directional_reviews_6CO1EhMb4Y3J_fkey" FOREIGN KEY ("canonical_design_id") REFERENCES "asset_family_canonical_designs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "directional_reviews" ADD CONSTRAINT "directional_reviews_wtboxfuZ7iwd_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "directional_reviews" ADD CONSTRAINT "directional_reviews_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "directional_reviews" ADD CONSTRAINT "directional_reviews_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;