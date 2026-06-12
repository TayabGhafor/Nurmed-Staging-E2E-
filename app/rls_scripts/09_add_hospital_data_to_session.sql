-- =====================================================
-- ADD HOSPITAL_DATA COLUMN TO SESSION TABLE
-- =====================================================
-- Migration script to add hospital_data column for storing
-- hospital redirect parameters (mrn, template, doctorId, encounterId)
-- =====================================================

-- Add hospital_data column as JSONB type to store structured hospital data
ALTER TABLE session
ADD COLUMN IF NOT EXISTS hospital_data JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN session.hospital_data IS 'JSON object containing hospital redirect parameters: mrn, template, doctorId, encounterId, new';

-- Create index on hospital_data for efficient queries (if needed)
-- CREATE INDEX IF NOT EXISTS idx_session_hospital_data ON session USING GIN (hospital_data);

-- =====================================================
-- MIGRATION COMPLETED ✅
-- =====================================================
-- Column: hospital_data (JSONB) - stores hospital redirect data
-- Usage: Store query parameters from hospital redirects
-- =====================================================
