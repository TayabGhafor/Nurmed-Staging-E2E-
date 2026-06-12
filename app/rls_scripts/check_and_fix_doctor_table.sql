-- =====================================================
-- CHECK AND FIX DOCTOR TABLE ISSUE
-- =====================================================
-- This script checks if doctor table exists and fixes the issue
-- =====================================================

-- Check if doctor table exists in public schema
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'doctor';

-- Check if doctor table exists in any schema
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'doctor';

-- Check current schema
SELECT current_schema();

-- Check all schemas
SELECT schema_name FROM information_schema.schemata;

-- If doctor table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.doctor (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    first_name TEXT NOT NULL,
    sur_name TEXT,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    registration_number TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    phone TEXT,
    specialization TEXT,
    license_number TEXT,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'doctor',
    hospital_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'doctor_user_id_fkey' 
        AND table_name = 'doctor'
    ) THEN
        ALTER TABLE public.doctor 
        ADD CONSTRAINT doctor_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.doctor TO public;
GRANT ALL ON public.doctor TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doctor_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.doctor_id_seq TO service_role;

-- Check if table was created successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'doctor' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test insert to make sure it works
INSERT INTO public.doctor (
    first_name, 
    last_name, 
    email, 
    registration_number, 
    department
) VALUES (
    'Test', 
    'Doctor', 
    'test@example.com', 
    'TEST001', 
    'Test Department'
) ON CONFLICT (email) DO NOTHING;

-- Clean up test record
DELETE FROM public.doctor WHERE email = 'test@example.com';

-- =====================================================
-- DOCTOR TABLE CHECK AND FIX COMPLETE ✅
-- =====================================================
