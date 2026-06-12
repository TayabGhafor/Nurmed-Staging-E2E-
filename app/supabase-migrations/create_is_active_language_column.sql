-- add is_active column to language table
ALTER TABLE public.language
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- set default values for created_at and updated_at columns
ALTER TABLE public.language
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- create index on is_active column
CREATE INDEX IF NOT EXISTS idx_language_is_active ON public.language USING btree (is_active);