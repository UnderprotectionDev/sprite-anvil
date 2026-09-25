CREATE TABLE IF NOT EXISTS "asset_record_measurements" (
	"asset_record_id" text,
	"measurements" jsonb NOT NULL,
	"project_id" text,
	CONSTRAINT "asset_record_measurements_pkey" PRIMARY KEY("project_id","asset_record_id")
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.asset_record_measurements') AND conname = 'asset_record_measurements_record_fk') THEN ALTER TABLE "asset_record_measurements" ADD CONSTRAINT "asset_record_measurements_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT; END IF; END $$;