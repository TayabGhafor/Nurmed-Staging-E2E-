-- =====================================================
-- CREATE DOCTOR TABLE - SAFE VERSION (HANDLES EXISTING OBJECTS)
-- =====================================================
-- Run this FIRST before any other scripts
-- This creates the basic doctor table structure safely
-- =====================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS doctor_updated_at_trigger ON doctor;
DROP TRIGGER IF EXISTS hospital_updated_at_trigger ON hospital;
DROP TRIGGER IF EXISTS session_updated_at_trigger ON session;
DROP TRIGGER IF EXISTS sessiontemplate_updated_at_trigger ON sessiontemplate;
DROP TRIGGER IF EXISTS section_updated_at_trigger ON section;
DROP TRIGGER IF EXISTS sessionsectiondata_updated_at_trigger ON sessionsectiondata;

-- Create or replace function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create doctor table if it doesn't exist
CREATE TABLE IF NOT EXISTS doctor (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
    role user_role DEFAULT 'doctor',
    hospital_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hospital table if it doesn't exist
CREATE TABLE IF NOT EXISTS hospital (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    email TEXT,
    phone TEXT,
    uses_ict10 BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create doctor_hospital mapping table if it doesn't exist
CREATE TABLE IF NOT EXISTS doctor_hospital (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctor(id) ON DELETE CASCADE,
    hospital_id INTEGER REFERENCES hospital(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, hospital_id)
);

-- Create session table if it doesn't exist
CREATE TABLE IF NOT EXISTS session (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctor(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    session_template_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create session template table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessiontemplate (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create section table if it doesn't exist
CREATE TABLE IF NOT EXISTS section (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create session template section mapping table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessiontemplate_section (
    id SERIAL PRIMARY KEY,
    sessiontemplate_id INTEGER REFERENCES sessiontemplate(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES section(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sessiontemplate_id, section_id)
);

-- Create session section data table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessionsectiondata (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES session(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES section(id) ON DELETE CASCADE,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversation (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES session(id) ON DELETE CASCADE,
    message TEXT,
    sender TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (ignore errors if they exist)
DO $$ 
BEGIN
    -- Doctor table indexes
    BEGIN
        CREATE INDEX idx_doctor_user_id ON doctor(user_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_email ON doctor(email);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_registration_number ON doctor(registration_number);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_hospital_id ON doctor(hospital_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_role ON doctor(role);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_is_active ON doctor(is_active);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    -- Doctor hospital mapping indexes
    BEGIN
        CREATE INDEX idx_doctor_hospital_doctor_id ON doctor_hospital(doctor_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_doctor_hospital_hospital_id ON doctor_hospital(hospital_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    -- Session table indexes
    BEGIN
        CREATE INDEX idx_session_doctor_id ON session(doctor_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_session_status ON session(status);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    -- Session section data indexes
    BEGIN
        CREATE INDEX idx_sessionsectiondata_session_id ON sessionsectiondata(session_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    BEGIN
        CREATE INDEX idx_sessionsectiondata_section_id ON sessionsectiondata(section_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
    
    -- Conversation table indexes
    BEGIN
        CREATE INDEX idx_conversation_session_id ON conversation(session_id);
    EXCEPTION WHEN duplicate_table THEN
        -- Index already exists, ignore
    END;
END $$;

-- Create triggers for updated_at
CREATE TRIGGER doctor_updated_at_trigger
  BEFORE UPDATE ON doctor
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hospital_updated_at_trigger
  BEFORE UPDATE ON hospital
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER session_updated_at_trigger
  BEFORE UPDATE ON session
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sessiontemplate_updated_at_trigger
  BEFORE UPDATE ON sessiontemplate
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER section_updated_at_trigger
  BEFORE UPDATE ON section
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sessionsectiondata_updated_at_trigger
  BEFORE UPDATE ON sessionsectiondata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('doctor', 'hospital', 'doctor_hospital', 'session', 'sessiontemplate', 'section', 'sessiontemplate_section', 'sessionsectiondata', 'conversation')
ORDER BY table_name;

-- Check doctor table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'doctor' 
ORDER BY ordinal_position;

-- =====================================================
-- BASIC TABLES CREATED SAFELY ✅
-- =====================================================
-- ✅ All existing triggers dropped first
-- ✅ doctor table created with all necessary columns
-- ✅ hospital table created
-- ✅ doctor_hospital mapping table created
-- ✅ session table created
-- ✅ sessiontemplate table created
-- ✅ section table created
-- ✅ sessiontemplate_section mapping table created
-- ✅ sessionsectiondata table created
-- ✅ conversation table created
-- ✅ Indexes created safely (ignores duplicates)
-- ✅ Triggers created for updated_at timestamps
-- =====================================================
