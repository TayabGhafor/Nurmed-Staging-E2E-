-- add is_active column to session_template table
ALTER TABLE public.session_template
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- set default values for created_at and updated_at columns
ALTER TABLE public.session_template
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- create index on is_active column
CREATE INDEX IF NOT EXISTS idx_session_template_is_active ON public.session_template USING btree (is_active);