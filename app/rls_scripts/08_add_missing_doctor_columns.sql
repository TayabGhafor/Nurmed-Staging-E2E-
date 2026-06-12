-- =====================================================
-- ADD MISSING DOCTOR TABLE COLUMNS
-- =====================================================
-- Run this AFTER 06_add_doctor_columns.sql
-- This adds commonly needed columns that might be missing
-- =====================================================

-- Add is_active column (commonly used for soft deletes)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add created_at and updated_at timestamps
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add phone column (commonly needed)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add specialization column (commonly needed)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS specialization TEXT;

-- Add license_number column (alternative to registration_number)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS license_number TEXT;

-- Add status column (for different doctor statuses)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- =====================================================
-- CREATE TRIGGER FOR UPDATED_AT TIMESTAMP
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_doctor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS doctor_updated_at_trigger ON doctor;
CREATE TRIGGER doctor_updated_at_trigger
  BEFORE UPDATE ON doctor
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_updated_at();

-- =====================================================
-- UPDATE EXISTING RECORDS
-- =====================================================

-- Set is_active to TRUE for all existing doctors
UPDATE doctor SET is_active = TRUE WHERE is_active IS NULL;

-- Set status to 'active' for all existing doctors
UPDATE doctor SET status = 'active' WHERE status IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all columns in doctor table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'doctor' 
ORDER BY ordinal_position;

-- Check sample data
SELECT 
  id, first_name, last_name, email, role, hospital_id, 
  is_active, status, created_at, updated_at
FROM doctor 
LIMIT 5;

-- =====================================================
-- MISSING DOCTOR COLUMNS ADDED ✅
-- =====================================================
-- ✅ is_active column added (default: TRUE)
-- ✅ created_at and updated_at timestamps added
-- ✅ phone column added
-- ✅ specialization column added
-- ✅ license_number column added
-- ✅ status column added (default: 'active')
-- ✅ Auto-update trigger for updated_at
-- ✅ Existing records updated with defaults
-- =====================================================
