CREATE TABLE "production_recipe_versions" (
	"id" text PRIMARY KEY,
	"recipe_id" text NOT NULL,
	"project_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"note" text,
	"content" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_recipe_versions_number_check" CHECK ("version_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "production_recipes" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"source_asset_record_id" text NOT NULL,
	"source_experiment_id" text NOT NULL,
	"source_generation_package_id" text NOT NULL,
	"source_trial_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "production_recipe_versions_recipe_number_idx" ON "production_recipe_versions" ("recipe_id","version_number");--> statement-breakpoint
CREATE INDEX "production_recipe_versions_created_by_user_id_idx" ON "production_recipe_versions" ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_recipes_project_id_idx" ON "production_recipes" ("project_id","id");--> statement-breakpoint
CREATE INDEX "production_recipes_project_created_at_idx" ON "production_recipes" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "production_recipes_created_by_user_id_idx" ON "production_recipes" ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "production_recipe_versions" ADD CONSTRAINT "production_recipe_versions_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_recipe_versions" ADD CONSTRAINT "production_recipe_versions_recipe_fk" FOREIGN KEY ("project_id","recipe_id") REFERENCES "production_recipes"("project_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_recipes" ADD CONSTRAINT "production_recipes_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "production_recipes" ADD CONSTRAINT "production_recipes_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;