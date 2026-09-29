CREATE TABLE "project_specialized_profile_contracts" (
	"project_id" text,
	"profile_id" text,
	"contract_revision_id" text NOT NULL,
	"activated_by_user_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_specialized_profile_contracts_pk" PRIMARY KEY("project_id","profile_id"),
	CONSTRAINT "project_specialized_profile_contracts_profile_id_check" CHECK ("profile_id" in ('character_creature_animation', 'object_weapon_equipment_states', 'icon', 'visual_effect_projectile_shadow_mark', 'tileset_terrain_texture', 'background_parallax', 'ui', 'portrait_logo_marketing'))
);
--> statement-breakpoint
CREATE TABLE "specialized_profile_contract_revisions" (
	"id" text PRIMARY KEY,
	"profile_id" text NOT NULL,
	"contract_schema_version" text NOT NULL,
	"contract_version" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "specialized_profile_contract_revisions_profile_id_check" CHECK ("profile_id" in ('character_creature_animation', 'object_weapon_equipment_states', 'icon', 'visual_effect_projectile_shadow_mark', 'tileset_terrain_texture', 'background_parallax', 'ui', 'portrait_logo_marketing')),
	CONSTRAINT "specialized_profile_contract_revisions_schema_version_check" CHECK ("contract_schema_version" = 'asset-profile/1.0.0'),
	CONSTRAINT "specialized_profile_contract_revisions_version_check" CHECK ("contract_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);
--> statement-breakpoint
CREATE INDEX "project_specialized_profile_contracts_activated_by_idx" ON "project_specialized_profile_contracts" ("activated_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_revisions_profile_version_idx" ON "specialized_profile_contract_revisions" ("profile_id","contract_version");--> statement-breakpoint
CREATE UNIQUE INDEX "specialized_profile_contract_revisions_profile_id_id_idx" ON "specialized_profile_contract_revisions" ("profile_id","id");--> statement-breakpoint
ALTER TABLE "project_specialized_profile_contracts" ADD CONSTRAINT "project_specialized_profile_contracts_040tM5byXzZn_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_specialized_profile_contracts" ADD CONSTRAINT "project_specialized_profile_contracts_627SMnvskF0L_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_specialized_profile_contracts" ADD CONSTRAINT "project_specialized_profile_contracts_revision_fk" FOREIGN KEY ("profile_id","contract_revision_id") REFERENCES "specialized_profile_contract_revisions"("profile_id","id") ON DELETE RESTRICT;