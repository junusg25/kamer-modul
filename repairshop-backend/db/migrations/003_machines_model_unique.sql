-- Add catalogue_number and ensure serial uniqueness per model (name + catalogue_number)
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS catalogue_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_machine_model_serial'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_machine_model_serial ON public.machines ((COALESCE(name, '''')), (COALESCE(catalogue_number, '''')), (COALESCE(serial_number, '''')))';
  END IF;
END$$;


