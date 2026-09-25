CREATE UNIQUE INDEX IF NOT EXISTS "asset_families_project_version_idx" ON "asset_families" ("project_id","id","canonical_version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_project_record_id_idx" ON "asset_versions" ("project_id","id","asset_record_id");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_derivatives_family_version_fk' AND conrelid = 'public.asset_record_derivatives'::regclass) THEN
		ALTER TABLE "asset_record_derivatives" ADD CONSTRAINT "asset_record_derivatives_family_version_fk" FOREIGN KEY ("project_id","asset_family_id","canonical_version_id") REFERENCES "asset_families"("project_id","id","canonical_version_id") ON DELETE RESTRICT;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "asset_version_review_events"
	DROP CONSTRAINT IF EXISTS "asset_version_reviews_project_version_fk",
	ADD CONSTRAINT "asset_version_reviews_project_version_fk"
		FOREIGN KEY ("project_id","version_id","asset_record_id")
		REFERENCES "asset_versions"("project_id","id","asset_record_id") ON DELETE RESTRICT;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_record_references_features_disjoint_check' AND conrelid = 'public.asset_record_references'::regclass) THEN
		ALTER TABLE "asset_record_references" ADD CONSTRAINT "asset_record_references_features_disjoint_check" CHECK (NOT ("transferred_features" && "forbidden_features"));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_quality_evidence_sha256_check' AND conrelid = 'public.asset_version_quality_evidence'::regclass) THEN
		ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_version_quality_evidence_byte_size_check' AND conrelid = 'public.asset_version_quality_evidence'::regclass) THEN
		ALTER TABLE "asset_version_quality_evidence" ADD CONSTRAINT "asset_version_quality_evidence_byte_size_check" CHECK ("byte_size" > 0);
	END IF;
END $$;
