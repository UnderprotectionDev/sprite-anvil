CREATE TABLE "export_profile_revisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"contract_version" text NOT NULL,
	"definition" jsonb NOT NULL,
	"content_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "export_profile_revisions_number_check" CHECK ("revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "export_profiles" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "export_profile_revisions_profile_number_idx" ON "export_profile_revisions" ("profile_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "export_profiles_project_id_id_idx" ON "export_profiles" ("project_id","id");--> statement-breakpoint
ALTER TABLE "export_profile_revisions" ADD CONSTRAINT "export_profile_revisions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_profile_revisions" ADD CONSTRAINT "export_profile_revisions_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "export_profiles"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_profiles" ADD CONSTRAINT "export_profiles_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "export_profiles" ADD CONSTRAINT "export_profiles_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;