CREATE TABLE "historical_risk_notices" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"delivery_target_id" text NOT NULL,
	"fulfilment_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"asset_record_id" text NOT NULL,
	"rights_record_id" text NOT NULL,
	"rights_record_version_number" integer NOT NULL,
	"rights_record_state" text NOT NULL,
	"pinned_policy" jsonb NOT NULL,
	"pinned_rights" jsonb,
	"affected_usage" jsonb NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historical_risk_notices_version_check" CHECK ("revision_number" > 0 AND "rights_record_version_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "historical_risk_notices_fulfilment_rights_idx" ON "historical_risk_notices" ("fulfilment_id","rights_record_id");--> statement-breakpoint
CREATE INDEX "historical_risk_notices_target_idx" ON "historical_risk_notices" ("project_id","delivery_target_id");--> statement-breakpoint
ALTER TABLE "historical_risk_notices" ADD CONSTRAINT "historical_risk_notices_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "historical_risk_notices" ADD CONSTRAINT "historical_risk_notices_fulfilment_fk" FOREIGN KEY ("project_id","fulfilment_id") REFERENCES "delivery_fulfilments"("project_id","id") ON DELETE CASCADE;