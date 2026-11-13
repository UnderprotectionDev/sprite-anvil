CREATE TABLE "deletion_receipts" (
	"background_operation_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"receipt_digest" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erasure_approvals" (
	"approved_by_user_id" text NOT NULL,
	"confirmed" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"idempotency_key" text NOT NULL,
	"project_id" text NOT NULL,
	"report_digest" text NOT NULL,
	"report_id" text NOT NULL,
	"request_digest" text NOT NULL,
	"selected_container_ids" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erasure_impact_reports" (
	"contract_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"report_digest" text NOT NULL,
	"request_digest" text NOT NULL,
	"scope" jsonb NOT NULL,
	"target_asset_record_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erasure_removal_starts" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"started_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erasure_tombstones" (
	"asset_record_id" text NOT NULL,
	"erased_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"receipt_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_receipts_project_id_id_idx" ON "deletion_receipts" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_approvals_project_id_id_idx" ON "erasure_approvals" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_impact_reports_project_id_id_idx" ON "erasure_impact_reports" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_removal_starts_project_id_id_idx" ON "erasure_removal_starts" ("project_id","id");--> statement-breakpoint
CREATE INDEX "erasure_tombstones_project_asset_record_idx" ON "erasure_tombstones" ("project_id","asset_record_id");--> statement-breakpoint
ALTER TABLE "deletion_receipts" ADD CONSTRAINT "deletion_receipts_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_approvals" ADD CONSTRAINT "erasure_approvals_approved_by_user_id_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_approvals" ADD CONSTRAINT "erasure_approvals_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_impact_reports" ADD CONSTRAINT "erasure_impact_reports_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_impact_reports" ADD CONSTRAINT "erasure_impact_reports_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_removal_starts" ADD CONSTRAINT "erasure_removal_starts_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_tombstones" ADD CONSTRAINT "erasure_tombstones_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;