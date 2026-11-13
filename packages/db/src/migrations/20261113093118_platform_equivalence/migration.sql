CREATE TABLE "platform_equivalence_reports" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"web_run_id" text,
	"desktop_run_id" text,
	"comparison" jsonb NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_equivalence_runs" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"surface" text NOT NULL,
	"bundle_id" text NOT NULL,
	"input_digest" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"request_digest" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_equivalence_runs_surface_check" CHECK ("surface" in ('web', 'desktop'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_equivalence_reports_project_id_id_idx" ON "platform_equivalence_reports" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_equivalence_runs_project_id_id_idx" ON "platform_equivalence_runs" ("project_id","id");--> statement-breakpoint
ALTER TABLE "platform_equivalence_reports" ADD CONSTRAINT "platform_equivalence_reports_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_reports" ADD CONSTRAINT "platform_equivalence_reports_DYi96GOTDSJ9_fkey" FOREIGN KEY ("web_run_id") REFERENCES "platform_equivalence_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_reports" ADD CONSTRAINT "platform_equivalence_reports_YUbcS6jgmsj9_fkey" FOREIGN KEY ("desktop_run_id") REFERENCES "platform_equivalence_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_reports" ADD CONSTRAINT "platform_equivalence_reports_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_runs" ADD CONSTRAINT "platform_equivalence_runs_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_runs" ADD CONSTRAINT "platform_equivalence_runs_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_equivalence_runs" ADD CONSTRAINT "platform_equivalence_runs_bundle_fk" FOREIGN KEY ("project_id","bundle_id") REFERENCES "export_bundles"("project_id","id") ON DELETE CASCADE;