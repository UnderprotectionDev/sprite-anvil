CREATE TABLE "asset_record_measurements" (
	"asset_record_id" text,
	"measurements" jsonb NOT NULL,
	"project_id" text,
	CONSTRAINT "asset_record_measurements_pkey" PRIMARY KEY("project_id","asset_record_id")
);
--> statement-breakpoint
ALTER TABLE "asset_record_measurements" ADD CONSTRAINT "asset_record_measurements_record_fk" FOREIGN KEY ("project_id","asset_record_id") REFERENCES "asset_records"("project_id","id") ON DELETE RESTRICT;