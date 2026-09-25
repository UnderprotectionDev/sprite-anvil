DO $$
BEGIN
	IF to_regclass('public.asset_families') IS NOT NULL
		AND to_regclass('public.visual_worlds') IS NOT NULL
		AND (
			SELECT count(*) = 2
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'asset_families'
				AND column_name IN ('project_id', 'visual_world_id')
		)
		AND (
			SELECT count(*) = 2
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'visual_worlds'
				AND column_name IN ('project_id', 'id')
		)
		AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = to_regclass('public.asset_families')
				AND conname = 'asset_families_project_visual_world_fk'
		) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_project_visual_world_fk"
			FOREIGN KEY ("project_id","visual_world_id")
			REFERENCES "visual_worlds"("project_id","id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_families') IS NOT NULL
		AND to_regclass('public.user') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_families' AND column_name = 'created_by_user_id'
		)
		AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = to_regclass('public.asset_families')
				AND conname = 'asset_families_created_by_user_id_user_id_fkey'
		) THEN
		ALTER TABLE "asset_families" ADD CONSTRAINT "asset_families_created_by_user_id_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_versions') IS NOT NULL
		AND to_regclass('public.user') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_versions' AND column_name = 'created_by_user_id'
		)
		AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = to_regclass('public.asset_versions')
				AND conname = 'asset_versions_created_by_user_id_user_id_fkey'
		) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_created_by_user_id_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;

	IF to_regclass('public.asset_version_review_events') IS NOT NULL
		AND to_regclass('public.user') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'asset_version_review_events' AND column_name = 'created_by_user_id'
		)
		AND NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = to_regclass('public.asset_version_review_events')
				AND conname = 'asset_version_review_events_created_by_user_id_user_id_fkey'
		) THEN
		ALTER TABLE "asset_version_review_events" ADD CONSTRAINT "asset_version_review_events_created_by_user_id_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;
	END IF;
END $$;
