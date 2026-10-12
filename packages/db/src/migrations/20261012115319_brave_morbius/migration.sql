CREATE TABLE "background_scrolling_tests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "background_scrolling_tests_family_idx" ON "background_scrolling_tests" ("project_id","asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "background_scrolling_tests" ADD CONSTRAINT "background_scrolling_tests_kz0WONQDj9o1_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_scrolling_tests" ADD CONSTRAINT "background_scrolling_tests_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "background_scrolling_tests" ADD CONSTRAINT "background_scrolling_tests_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;