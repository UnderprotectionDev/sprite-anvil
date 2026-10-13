CREATE TABLE "ui_stretch_tests" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"contract_revision_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ui_stretch_tests_family_idx" ON "ui_stretch_tests" ("project_id","asset_family_id","created_at");--> statement-breakpoint
ALTER TABLE "ui_stretch_tests" ADD CONSTRAINT "ui_stretch_tests_rpsUvdx8vVib_fkey" FOREIGN KEY ("contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ui_stretch_tests" ADD CONSTRAINT "ui_stretch_tests_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ui_stretch_tests" ADD CONSTRAINT "ui_stretch_tests_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;