-- =====================================================
-- CREATE DOCTOR TABLE - SIMPLE VERSION
-- =====================================================
-- Just creates the basic doctor table with auth.users relationship
-- =====================================================

-- Drop existing doctor table if it exists
DROP TABLE IF EXISTS public.doctor CASCADE;

-- Create doctor table
CREATE TABLE public.doctor (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    sur_name TEXT,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    registration_number TEXT NOT NULL,
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

-- Create unique constraints
ALTER TABLE public.doctor ADD CONSTRAINT doctor_email_unique UNIQUE (email);
ALTER TABLE public.doctor ADD CONSTRAINT doctor_registration_number_unique UNIQUE (registration_number);

-- Grant permissions
GRANT ALL ON public.doctor TO public;
GRANT ALL ON public.doctor TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doctor_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.doctor_id_seq TO service_role;

-- =====================================================
-- DOCTOR TABLE CREATED ✅
-- =====================================================
