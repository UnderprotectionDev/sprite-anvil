CREATE TABLE "erasure_impact_reports" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"target_asset_record_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"report_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"scope" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_impact_reports_project_id_id_idx" ON "erasure_impact_reports" ("project_id","id");--> statement-breakpoint
ALTER TABLE "erasure_impact_reports" ADD CONSTRAINT "erasure_impact_reports_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_impact_reports" ADD CONSTRAINT "erasure_impact_reports_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;