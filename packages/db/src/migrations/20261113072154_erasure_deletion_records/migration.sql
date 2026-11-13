CREATE TABLE "erasure_authorizations" (
	"authorized_by_user_id" text NOT NULL,
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
CREATE TABLE "erasure_receipts" (
	"background_operation_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"receipt_digest" text NOT NULL
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
CREATE UNIQUE INDEX "erasure_authorizations_project_id_id_idx" ON "erasure_authorizations" ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_receipts_project_id_id_idx" ON "erasure_receipts" ("project_id","id");--> statement-breakpoint
CREATE INDEX "erasure_tombstones_project_asset_record_idx" ON "erasure_tombstones" ("project_id","asset_record_id");--> statement-breakpoint
ALTER TABLE "erasure_authorizations" ADD CONSTRAINT "erasure_authorizations_authorized_by_user_id_user_id_fkey" FOREIGN KEY ("authorized_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_authorizations" ADD CONSTRAINT "erasure_authorizations_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_receipts" ADD CONSTRAINT "erasure_receipts_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "erasure_tombstones" ADD CONSTRAINT "erasure_tombstones_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;