CREATE TABLE "measurement_definitions" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"metric_id" text NOT NULL,
	"version" integer NOT NULL,
	"contract_version" text NOT NULL,
	"event_family" text NOT NULL,
	"start_event" text NOT NULL,
	"end_event" text NOT NULL,
	"scope" jsonb NOT NULL,
	"numerator" jsonb NOT NULL,
	"denominator" jsonb NOT NULL,
	"exclusions" jsonb NOT NULL,
	"time_window_days" integer NOT NULL,
	"retention_days" integer NOT NULL,
	"decision_use" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_definitions_version_check" CHECK ("version" > 0),
	CONSTRAINT "measurement_definitions_event_family_check" CHECK ("event_family" in ('production_workflow', 'review_and_repair', 'import_mapping', 'export_delivery', 'runtime_validation', 'offline_verification')),
	CONSTRAINT "measurement_definitions_window_check" CHECK ("time_window_days" > 0 and "retention_days" > 0),
	CONSTRAINT "measurement_definitions_events_check" CHECK ("start_event" <> "end_event")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_definitions_owner_metric_version_idx" ON "measurement_definitions" ("owner_user_id","metric_id","version");--> statement-breakpoint
ALTER TABLE "measurement_definitions" ADD CONSTRAINT "measurement_definitions_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;