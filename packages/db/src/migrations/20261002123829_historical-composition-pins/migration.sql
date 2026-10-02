CREATE TABLE "historical_composition_pins" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"composite_version_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"context_revision_id" text NOT NULL,
	"canonical_design_version_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historical_pins_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "historical_pins_idempotency_idx" ON "historical_composition_pins" ("project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "historical_pins_project_created_idx" ON "historical_composition_pins" ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "historical_composition_pins" ADD CONSTRAINT "historical_composition_pins_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "historical_composition_pins" ADD CONSTRAINT "historical_composition_pins_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "historical_composition_pins" ADD CONSTRAINT "historical_pins_composite_fk" FOREIGN KEY ("project_id","composite_version_id","asset_record_id") REFERENCES "composite_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "historical_composition_pins" ADD CONSTRAINT "historical_pins_context_fk" FOREIGN KEY ("project_id","context_revision_id") REFERENCES "context_revisions"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "historical_composition_pins" ADD CONSTRAINT "historical_pins_canonical_fk" FOREIGN KEY ("project_id","canonical_design_version_id") REFERENCES "asset_versions"("project_id","id") ON DELETE RESTRICT;