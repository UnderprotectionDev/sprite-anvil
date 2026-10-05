CREATE TABLE "asset_family_comparisons" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_family_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "asset_family_comparisons_project_family_created_idx" ON "asset_family_comparisons" ("project_id","asset_family_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_family_comparisons_created_by_user_id_idx" ON "asset_family_comparisons" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "asset_family_comparisons" ADD CONSTRAINT "asset_family_comparisons_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_comparisons" ADD CONSTRAINT "asset_family_comparisons_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_family_comparisons" ADD CONSTRAINT "asset_family_comparisons_project_family_fk" FOREIGN KEY ("project_id","asset_family_id") REFERENCES "asset_families"("project_id","id") ON DELETE RESTRICT;