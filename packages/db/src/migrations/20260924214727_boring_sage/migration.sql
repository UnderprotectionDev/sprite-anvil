DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_records_availability_check'
			AND conrelid = 'public.asset_records'::regclass
	) THEN
		ALTER TABLE "asset_records"
			ADD CONSTRAINT "asset_records_availability_check"
			CHECK ("availability" IN ('active', 'archived', 'erased'));
	END IF;
END $$;
