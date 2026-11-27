CREATE TABLE "project_deletion_jobs" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"scope_digest" text NOT NULL,
	"impact" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"operation_id" text,
	"state" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "project_deletion_jobs_owner_idx" ON "project_deletion_jobs" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_deletion_jobs_scope_idx" ON "project_deletion_jobs" ("project_id","scope_digest");--> statement-breakpoint
ALTER TABLE "project_deletion_jobs" ADD CONSTRAINT "project_deletion_jobs_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;