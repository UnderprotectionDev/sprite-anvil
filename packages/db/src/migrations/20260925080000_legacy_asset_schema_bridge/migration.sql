DO $$
BEGIN
	IF to_regclass('public.asset_families') IS NOT NULL THEN
		ALTER TABLE "asset_families" ADD COLUMN IF NOT EXISTS "canonical_version_id" text;
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_families' AND column_name = 'subject_identity_id'
		) THEN
			ALTER TABLE "asset_families" ALTER COLUMN "subject_identity_id" DROP NOT NULL;
		END IF;
		ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_created_by_user_id_user_id_fkey";
		ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_project_visual_world_fk";
		ALTER TABLE "asset_families" DROP CONSTRAINT IF EXISTS "asset_families_project_subject_identity_fk";
	END IF;

	IF to_regclass('public.asset_records') IS NOT NULL THEN
		ALTER TABLE "asset_records" DROP CONSTRAINT IF EXISTS "asset_records_project_asset_family_fk";
	END IF;

	IF to_regclass('public.asset_versions') IS NOT NULL THEN
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'content_length'
		) AND NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'byte_size'
		) THEN
			ALTER TABLE "asset_versions" RENAME COLUMN "content_length" TO "byte_size";
		ELSIF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'content_length'
		) AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'byte_size'
		) THEN
			RAISE EXCEPTION 'asset_versions has both content_length and byte_size; refusing ambiguous migration';
		END IF;
		ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "file_name" text;
		ALTER TABLE "asset_versions" ADD COLUMN IF NOT EXISTS "sha256" text;
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'asset_family_id'
		) THEN
			ALTER TABLE "asset_versions" ALTER COLUMN "asset_family_id" DROP NOT NULL;
		END IF;
		ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_created_by_user_id_user_id_fkey";
		ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_project_family_record_fk";
	END IF;

	IF to_regclass('public.asset_version_review_events') IS NOT NULL THEN
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'asset_version_id'
		) AND NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'version_id'
		) THEN
			ALTER TABLE "asset_version_review_events" RENAME COLUMN "asset_version_id" TO "version_id";
		ELSIF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'asset_version_id'
		) AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'version_id'
		) THEN
			RAISE EXCEPTION 'asset_version_review_events has both asset_version_id and version_id; refusing ambiguous migration';
		END IF;
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'type'
		) AND NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'decision'
		) THEN
			ALTER TABLE "asset_version_review_events" RENAME COLUMN "type" TO "decision";
		ELSIF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'type'
		) AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'decision'
		) THEN
			RAISE EXCEPTION 'asset_version_review_events has both type and decision; refusing ambiguous migration';
		END IF;
		ALTER TABLE "asset_version_review_events" ADD COLUMN IF NOT EXISTS "rationale" text;
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'asset_family_id'
		) THEN
			ALTER TABLE "asset_version_review_events" ALTER COLUMN "asset_family_id" DROP NOT NULL;
		END IF;
		ALTER TABLE "asset_version_review_events" DROP CONSTRAINT IF EXISTS "asset_version_review_events_created_by_user_id_user_id_fkey";
		ALTER TABLE "asset_version_review_events" DROP CONSTRAINT IF EXISTS "asset_version_review_events_version_fk";
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF to_regclass('public.asset_families') IS NOT NULL
		AND to_regclass('public.subject_identities') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_families' AND column_name = 'subject_identity_id'
		) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_subject_identity_fk"
			FOREIGN KEY ("project_id", "subject_identity_id")
			REFERENCES "subject_identities"("project_id", "id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_versions') IS NOT NULL
		AND to_regclass('public.asset_records') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'asset_family_id'
		) THEN
		CREATE UNIQUE INDEX IF NOT EXISTS "asset_records_project_family_id_idx"
			ON "asset_records" ("project_id", "asset_family_id", "id");
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_asset_family_fk"
			FOREIGN KEY ("project_id", "asset_family_id")
			REFERENCES "asset_families"("project_id", "id") ON DELETE RESTRICT;
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_project_family_record_fk"
			FOREIGN KEY ("project_id", "asset_family_id", "asset_record_id")
			REFERENCES "asset_records"("project_id", "asset_family_id", "id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_version_review_events') IS NOT NULL
		AND to_regclass('public.asset_versions') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'asset_family_id'
		) THEN
		CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_family_record_id_idx"
			ON "asset_versions" ("project_id", "asset_family_id", "asset_record_id", "id");
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_review_events_version_fk"
			FOREIGN KEY ("project_id", "asset_family_id", "asset_record_id", "version_id")
			REFERENCES "asset_versions"("project_id", "asset_family_id", "asset_record_id", "id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_versions') IS NOT NULL THEN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_content_type_check') THEN
			ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_content_type_check" CHECK ("content_type" IN ('image/png', 'image/webp'));
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_sha256_check') THEN
			ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$');
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_versions') AND conname = 'asset_versions_byte_size_check') THEN
			ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_byte_size_check" CHECK ("byte_size" > 0);
		END IF;
	END IF;

	IF to_regclass('public.asset_version_review_events') IS NOT NULL
		AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_version_review_events') AND conname = 'asset_version_reviews_decision_check') THEN
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_reviews_decision_check"
			CHECK ("decision" IN ('candidate', 'approved', 'rejected'));
	END IF;
END $$;
