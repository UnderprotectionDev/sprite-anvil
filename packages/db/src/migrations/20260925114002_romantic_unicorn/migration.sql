ALTER TABLE "asset_records" ADD COLUMN "asset_category" text;--> statement-breakpoint
ALTER TABLE "asset_records" ADD COLUMN "visual_world_id" text;--> statement-breakpoint
ALTER TABLE "asset_records" ADD COLUMN "theme_id" text;--> statement-breakpoint
ALTER TABLE "asset_records" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "source_image_width" integer;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "source_image_height" integer;--> statement-breakpoint
CREATE INDEX "asset_records_project_category_idx" ON "asset_records" ("project_id","asset_category");--> statement-breakpoint
CREATE INDEX "asset_records_project_availability_idx" ON "asset_records" ("project_id","availability");--> statement-breakpoint
CREATE INDEX "asset_versions_project_source_image_dimensions_idx" ON "asset_versions" ("project_id","source_image_width","source_image_height","asset_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "themes_project_visual_world_id_idx" ON "themes" ("project_id","visual_world_id","id");--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_visual_world_fk" FOREIGN KEY ("project_id","visual_world_id") REFERENCES "visual_worlds"("project_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_project_visual_world_theme_fk" FOREIGN KEY ("project_id","visual_world_id","theme_id") REFERENCES "themes"("project_id","visual_world_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_category_check" CHECK ("asset_category" IS NULL OR "asset_category" IN ('character_creature_animation', 'object_weapon_equipment_states', 'icon', 'visual_effect_projectile_shadow_mark', 'tileset_terrain_texture', 'background_parallax', 'ui', 'portrait_logo_marketing', 'other'));--> statement-breakpoint
ALTER TABLE "asset_records" ADD CONSTRAINT "asset_records_theme_requires_visual_world_check" CHECK ("theme_id" IS NULL OR "visual_world_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_image_dimensions_check" CHECK (("source_image_width" IS NULL AND "source_image_height" IS NULL) OR ("source_image_width" IS NOT NULL AND "source_image_height" IS NOT NULL AND "source_image_width" > 0 AND "source_image_height" > 0));