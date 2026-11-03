CREATE TABLE "production_experiment_trials" (
	"id" text PRIMARY KEY,
	"experiment_id" text NOT NULL,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"generation_package_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_experiment_trials_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "production_experiments" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"asset_record_id" text NOT NULL,
	"title" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"outcome" text,
	"selected_trial_id" text,
	"outcome_note" text,
	"concluded_by_user_id" text,
	"concluded_at" timestamp,
	CONSTRAINT "production_experiments_conclusion_check" CHECK (("outcome" IS NULL AND "selected_trial_id" IS NULL AND "concluded_at" IS NULL AND "concluded_by_user_id" IS NULL) OR ("outcome" IN ('selection_made', 'inconclusive', 'abandoned') AND "concluded_at" IS NOT NULL AND "concluded_by_user_id" IS NOT NULL AND (("outcome" = 'selection_made') = ("selected_trial_id" IS NOT NULL))))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "production_experiment_trials_experiment_package_idx" ON "production_experiment_trials" ("experiment_id","generation_package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_experiment_trials_experiment_version_idx" ON "production_experiment_trials" ("experiment_id","asset_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_experiment_trials_experiment_position_idx" ON "production_experiment_trials" ("experiment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "production_experiment_trials_experiment_id_id_idx" ON "production_experiment_trials" ("experiment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_experiments_project_record_id_idx" ON "production_experiments" ("project_id","asset_record_id","id");--> statement-breakpoint
CREATE INDEX "production_experiments_project_record_created_at_idx" ON "production_experiments" ("project_id","asset_record_id","created_at");--> statement-breakpoint
CREATE INDEX "production_experiments_created_by_user_id_idx" ON "production_experiments" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "production_experiment_trials" ADD CONSTRAINT "production_experiment_trials_experiment_fk" FOREIGN KEY ("project_id","asset_record_id","experiment_id") REFERENCES "production_experiments"("project_id","asset_record_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiment_trials" ADD CONSTRAINT "production_experiment_trials_generation_package_fk" FOREIGN KEY ("project_id","asset_record_id","generation_package_id") REFERENCES "generation_packages"("project_id","asset_record_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiment_trials" ADD CONSTRAINT "production_experiment_trials_asset_version_fk" FOREIGN KEY ("project_id","asset_version_id","asset_record_id") REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiments" ADD CONSTRAINT "production_experiments_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiments" ADD CONSTRAINT "production_experiments_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiments" ADD CONSTRAINT "production_experiments_concluded_by_user_id_user_id_fkey" FOREIGN KEY ("concluded_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_experiments" ADD CONSTRAINT "production_experiments_project_asset_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE CASCADE;