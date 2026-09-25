ALTER TABLE "asset_records"
	ADD COLUMN IF NOT EXISTS "asset_category" text,
	ADD COLUMN IF NOT EXISTS "visual_world_id" text,
	ADD COLUMN IF NOT EXISTS "theme_id" text,
	ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_versions"
	ADD COLUMN IF NOT EXISTS "source_image_width" integer,
	ADD COLUMN IF NOT EXISTS "source_image_height" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_project_category_idx" ON "asset_records" ("project_id","asset_category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_records_project_availability_idx" ON "asset_records" ("project_id","availability");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_versions_project_source_image_dimensions_idx" ON "asset_versions" ("project_id","source_image_width","source_image_height","asset_record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "themes_project_visual_world_id_idx" ON "themes" ("project_id","visual_world_id","id");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_project_visual_world_fk' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_visual_world_fk" FOREIGN KEY ("project_id","visual_world_id") REFERENCES "visual_worlds"("project_id","id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_project_visual_world_theme_fk' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_visual_world_theme_fk" FOREIGN KEY ("project_id","visual_world_id","theme_id") REFERENCES "themes"("project_id","visual_world_id","id") ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_category_check' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_category_check" CHECK ("asset_category" IS NULL OR "asset_category" IN ('character_creature_animation', 'object_weapon_equipment_states', 'icon', 'visual_effect_projectile_shadow_mark', 'tileset_terrain_texture', 'background_parallax', 'ui', 'portrait_logo_marketing', 'other'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_records_theme_requires_visual_world_check' AND conrelid = 'public.asset_records'::regclass) THEN
		ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_theme_requires_visual_world_check" CHECK ("theme_id" IS NULL OR "visual_world_id" IS NOT NULL);
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_versions_source_image_dimensions_check' AND conrelid = 'public.asset_versions'::regclass) THEN
		ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_image_dimensions_check" CHECK (("source_image_width" IS NULL AND "source_image_height" IS NULL) OR ("source_image_width" IS NOT NULL AND "source_image_height" IS NOT NULL AND "source_image_width" > 0 AND "source_image_height" > 0));
	END IF;
END $$;
