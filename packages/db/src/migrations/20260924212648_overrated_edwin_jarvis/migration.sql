CREATE TABLE "asset_records" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"name" text NOT NULL,
	"identity_criteria" text[] NOT NULL,
	"support_level" text NOT NULL,
	"availability" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_records_identity_criteria_nonempty_check" CHECK (cardinality("identity_criteria") >= 1)
);
--> statement-breakpoint
CREATE INDEX "asset_records_project_created_at_idx" ON "asset_records" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_records_created_by_user_id_idx" ON "asset_records" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;