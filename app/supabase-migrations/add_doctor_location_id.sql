-- Add optional location_id column to doctor table
-- Run this in Supabase SQL Editor or via migrations to fix "Could not find the 'location_id' column" error

ALTER TABLE public.doctor ADD COLUMN IF NOT EXISTS location_id INTEGER;

-- Optional: if you have a location table, add the foreign key:
-- ALTER TABLE public.doctor ADD CONSTRAINT fk_doctor_location_id
--   FOREIGN KEY (location_id) REFERENCES public.location(id);
