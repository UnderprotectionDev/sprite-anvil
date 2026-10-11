CREATE TABLE "texture_repetition_reviews" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "texture_repetition_reviews_family_idx" ON "texture_repetition_reviews" ("project_id","asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "texture_repetition_reviews" ADD CONSTRAINT "texture_repetition_reviews_8LnS9T863p1Y_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "texture_repetition_reviews" ADD CONSTRAINT "texture_repetition_reviews_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "texture_repetition_reviews" ADD CONSTRAINT "texture_repetition_reviews_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;