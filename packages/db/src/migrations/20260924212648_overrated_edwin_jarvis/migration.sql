CREATE TABLE IF NOT EXISTS "asset_records" (
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
ALTER TABLE "asset_records"
	ADD COLUMN IF NOT EXISTS "identity_criteria" text[],
	ADD COLUMN IF NOT EXISTS "support_level" text DEFAULT 'general' NOT NULL,
	ADD COLUMN IF NOT EXISTS "availability" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_records"
	ALTER COLUMN "support_level" DROP DEFAULT,
	ALTER COLUMN "availability" DROP DEFAULT;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_records_identity_criteria_nonempty_check'
			AND conrelid = 'public.asset_records'::regclass
	) THEN
		ALTER TABLE "asset_records"
			ADD CONSTRAINT "asset_records_identity_criteria_nonempty_check"
			CHECK ("identity_criteria" IS NULL OR cardinality("identity_criteria") >= 1);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_records_project_id_project_id_fkey'
			AND conrelid = 'public.asset_records'::regclass
	) THEN
		ALTER TABLE "asset_records"
			ADD CONSTRAINT "asset_records_project_id_project_id_fkey"
			FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_records_created_by_user_id_user_id_fkey'
			AND conrelid = 'public.asset_records'::regclass
	) THEN
		ALTER TABLE "asset_records"
			ADD CONSTRAINT "asset_records_created_by_user_id_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;

	IF to_regclass('public.asset_families') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_records'
				AND column_name = 'asset_family_id'
		)
		AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conname = 'asset_records_project_asset_family_fk'
				AND conrelid = 'public.asset_records'::regclass
		) THEN
		ALTER TABLE "asset_records"
			ADD CONSTRAINT "asset_records_project_asset_family_fk"
			FOREIGN KEY ("project_id", "asset_family_id")
			REFERENCES "asset_families"("project_id", "id") ON DELETE CASCADE;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_project_created_at_idx" ON "asset_records" ("project_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_created_by_user_id_idx" ON "asset_records" ("created_by_user_id");
