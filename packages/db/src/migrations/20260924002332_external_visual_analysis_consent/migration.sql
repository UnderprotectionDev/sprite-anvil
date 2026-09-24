CREATE TYPE "external_visual_analysis_category" AS ENUM('identity', 'theme', 'style');--> statement-breakpoint
CREATE TABLE "external_visual_analysis_permission" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"category" "external_visual_analysis_category" NOT NULL,
	"purpose" text NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "external_visual_analysis_permission_project_idx" ON "external_visual_analysis_permission" ("project_id");--> statement-breakpoint
CREATE INDEX "external_visual_analysis_permission_project_category_idx" ON "external_visual_analysis_permission" ("project_id","category");--> statement-breakpoint
ALTER TABLE "external_visual_analysis_permission" ADD CONSTRAINT "external_visual_analysis_permission_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "external_visual_analysis_permission" ADD CONSTRAINT "external_visual_analysis_permission_DvhNARdGe0XL_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;