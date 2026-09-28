CREATE TABLE "import_inbox_entries" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"file_name" text NOT NULL,
	"source_content_type" text NOT NULL,
	"content_length" bigint NOT NULL,
	"sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_inbox_entries_file_name_check" CHECK ("file_name" = btrim("file_name") AND char_length("file_name") BETWEEN 1 AND 255),
	CONSTRAINT "import_inbox_entries_source_content_type_check" CHECK (char_length("source_content_type") BETWEEN 1 AND 127),
	CONSTRAINT "import_inbox_entries_content_length_check" CHECK ("content_length" > 0),
	CONSTRAINT "import_inbox_entries_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE INDEX "import_inbox_entries_project_created_at_idx" ON "import_inbox_entries" ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "import_inbox_entries" ADD CONSTRAINT "import_inbox_entries_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "import_inbox_entries" ADD CONSTRAINT "import_inbox_entries_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;