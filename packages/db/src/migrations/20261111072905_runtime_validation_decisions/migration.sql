CREATE TABLE "runtime_validation_decisions" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"record_id" text NOT NULL,
	"kind" text NOT NULL,
	"outcome" text,
	"failure_source" text,
	"request_digest" text NOT NULL,
	"decided_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_validation_decisions_content_check" CHECK (("kind" = 'outcome' and "outcome" in ('pass', 'fail', 'inconclusive') and "failure_source" is null) or ("kind" = 'failure_source' and "outcome" is null and "failure_source" in ('asset_content', 'engine_adapter', 'game_configuration', 'multiple_sources')))
);
--> statement-breakpoint
ALTER TABLE "delivery_target_drafts" ADD COLUMN "runtime_validation_criterion" jsonb;--> statement-breakpoint
ALTER TABLE "runtime_validation_records" ADD COLUMN "supersedes_record_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_validation_decisions_one_outcome_idx" ON "runtime_validation_decisions" ("record_id") WHERE "kind" = 'outcome';--> statement-breakpoint
ALTER TABLE "runtime_validation_decisions" ADD CONSTRAINT "runtime_validation_decisions_decided_by_user_id_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runtime_validation_decisions" ADD CONSTRAINT "runtime_validation_decisions_record_fk" FOREIGN KEY ("project_id","record_id") REFERENCES "runtime_validation_records"("project_id","id") ON DELETE CASCADE;