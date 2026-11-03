ALTER TABLE "production_recipes" ALTER COLUMN "source_asset_record_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "production_recipes" ALTER COLUMN "source_experiment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "production_recipes" ALTER COLUMN "source_generation_package_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "production_recipes" ALTER COLUMN "source_trial_id" DROP NOT NULL;