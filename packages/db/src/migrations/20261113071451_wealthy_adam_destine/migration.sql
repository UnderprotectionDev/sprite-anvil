CREATE TABLE "measurement_events" (
	"id" text PRIMARY KEY,
	"definition_id" text NOT NULL,
	"definition_version" integer NOT NULL,
	"metric_id" text NOT NULL,
	"event_family" text NOT NULL,
	"user_pseudonym" text NOT NULL,
	"project_pseudonym" text NOT NULL,
	"workflow_id" text NOT NULL,
	"record_kind" text NOT NULL,
	"event_name" text NOT NULL,
	"surface" text NOT NULL,
	"outcome_class" text NOT NULL,
	"counters" jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_events_surface_check" CHECK ("surface" in ('web', 'desktop')),
	CONSTRAINT "measurement_events_version_check" CHECK ("definition_version" > 0)
);
--> statement-breakpoint
CREATE INDEX "measurement_events_definition_workflow_idx" ON "measurement_events" ("definition_id","workflow_id");--> statement-breakpoint
ALTER TABLE "measurement_events" ADD CONSTRAINT "measurement_events_4Dmzfq6Fu2HC_fkey" FOREIGN KEY ("definition_id") REFERENCES "measurement_definitions"("id") ON DELETE CASCADE;