CREATE TYPE "background_operation_kind" AS ENUM('archive', 'restore', 'export', 'verification', 'deletion');--> statement-breakpoint
CREATE TYPE "background_operation_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancel_requested', 'cancelled');--> statement-breakpoint
CREATE TABLE "background_operation_outbox" (
	"id" text PRIMARY KEY,
	"operation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "background_operations" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"kind" "background_operation_kind" NOT NULL,
	"scope_summary" text NOT NULL,
	"scope_target_id" text,
	"trigger_summary" text NOT NULL,
	"triggered_by_user_id" text NOT NULL,
	"status" "background_operation_status" DEFAULT 'pending'::"background_operation_status" NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"progress_percent" integer,
	"progress_step" text,
	"result_summary" text,
	"failure_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"heartbeat_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "background_operation_outbox_unpublished_idx" ON "background_operation_outbox" ("published_at","created_at");--> statement-breakpoint
CREATE INDEX "background_operation_outbox_operation_id_idx" ON "background_operation_outbox" ("operation_id");--> statement-breakpoint
CREATE INDEX "background_operations_project_created_at_idx" ON "background_operations" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "background_operations_status_heartbeat_idx" ON "background_operations" ("status","heartbeat_at","updated_at");--> statement-breakpoint
CREATE INDEX "background_operations_triggered_by_user_id_idx" ON "background_operations" ("triggered_by_user_id");--> statement-breakpoint
ALTER TABLE "background_operation_outbox" ADD CONSTRAINT "background_operation_outbox_YjOeSfErAdhC_fkey" FOREIGN KEY ("operation_id") REFERENCES "background_operations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "background_operations" ADD CONSTRAINT "background_operations_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "background_operations" ADD CONSTRAINT "background_operations_triggered_by_user_id_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;