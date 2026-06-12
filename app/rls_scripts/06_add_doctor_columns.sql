-- =====================================================
-- ADD ROLE AND HOSPITAL_ID COLUMNS TO DOCTOR TABLE
-- =====================================================
-- Run this AFTER 00_setup_roles_and_functions.sql
-- This adds columns and populates them from auth metadata
-- =====================================================

-- Add role column to doctor table
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'doctor';

-- Add hospital_id column to doctor table  
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS hospital_id INTEGER;

-- Add foreign key constraint for hospital_id
ALTER TABLE doctor ADD CONSTRAINT fk_doctor_hospital_id 
FOREIGN KEY (hospital_id) REFERENCES hospital(id);

-- =====================================================
-- POPULATE COLUMNS WITH VALUES FROM AUTH METADATA
-- =====================================================

-- Update role column from auth metadata
UPDATE doctor 
SET role = COALESCE(
  (SELECT (u.raw_user_meta_data->>'role')::user_role 
   FROM auth.users u 
   WHERE u.id = doctor.user_id), 
  'doctor'::user_role
);

-- Update hospital_id column from auth metadata (for hospital admins)
UPDATE doctor 
SET hospital_id = (
  SELECT (u.raw_user_meta_data->>'hospital_id')::INTEGER 
  FROM auth.users u 
  WHERE u.id = doctor.user_id 
  AND u.raw_user_meta_data->>'role' = 'hospitalAdmin'
);

-- For doctors, get hospital_id from doctor_hospital mapping table
UPDATE doctor 
SET hospital_id = (
  SELECT dh.hospital_id 
  FROM doctor_hospital dh 
  WHERE dh.doctor_id = doctor.id
)
WHERE doctor.role = 'doctor' 
AND doctor.hospital_id IS NULL;

-- =====================================================
-- UPDATE HELPER FUNCTIONS TO USE DOCTOR TABLE COLUMNS
-- =====================================================

-- Update get_user_role function to check doctor table first
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
  user_metadata jsonb;
  role_value text;
  doctor_role user_role;
BEGIN
  -- First try to get role from doctor table
  SELECT d.role INTO doctor_role
  FROM doctor d
  WHERE d.user_id = auth.uid();
  
  IF doctor_role IS NOT NULL THEN
    RETURN doctor_role;
  END IF;
  
  -- Fallback to auth metadata
  SELECT raw_user_meta_data INTO user_metadata 
  FROM auth.users 
  WHERE id = auth.uid();
  
  role_value := COALESCE(user_metadata->>'role', 'doctor');
  RETURN role_value::user_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'doctor'::user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_hospital_id function to check doctor table first
CREATE OR REPLACE FUNCTION get_user_hospital_id()
RETURNS INTEGER AS $$
DECLARE
  user_metadata jsonb;
  doctor_hospital_id INTEGER;
BEGIN
  -- First try to get hospital_id from doctor table
  SELECT d.hospital_id INTO doctor_hospital_id
  FROM doctor d
  WHERE d.user_id = auth.uid();
  
  IF doctor_hospital_id IS NOT NULL THEN
    RETURN doctor_hospital_id;
  END IF;
  
  -- Fallback to auth metadata
  SELECT raw_user_meta_data INTO user_metadata 
  FROM auth.users 
  WHERE id = auth.uid();
  
  RETURN (user_metadata->>'hospital_id')::integer;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE RLS POLICIES TO USE DOCTOR TABLE COLUMNS
-- =====================================================

-- Drop existing doctor RLS policies
DROP POLICY IF EXISTS "doctor_service_role_bypass" ON doctor;
DROP POLICY IF EXISTS "doctor_super_admin_all" ON doctor;
DROP POLICY IF EXISTS "doctor_hospital_admin_read" ON doctor;
DROP POLICY IF EXISTS "doctor_hospital_admin_update" ON doctor;
DROP POLICY IF EXISTS "doctor_hospital_admin_insert" ON doctor;
DROP POLICY IF EXISTS "doctor_own_profile_read" ON doctor;
DROP POLICY IF EXISTS "doctor_own_profile_update" ON doctor;
DROP POLICY IF EXISTS "doctor_block_unauthorized_insert" ON doctor;
DROP POLICY IF EXISTS "doctor_block_unauthorized_delete" ON doctor;

-- Recreate doctor RLS policies using doctor table columns
CREATE POLICY "doctor_service_role_bypass" ON doctor
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "doctor_super_admin_all" ON doctor
  FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Hospital admin can manage doctors in their hospital
CREATE POLICY "doctor_hospital_admin_read" ON doctor
  FOR SELECT TO public
  USING (is_hospital_admin() AND hospital_id = get_user_hospital_id());

CREATE POLICY "doctor_hospital_admin_update" ON doctor
  FOR UPDATE TO public
  USING (is_hospital_admin() AND hospital_id = get_user_hospital_id())
  WITH CHECK (is_hospital_admin() AND hospital_id = get_user_hospital_id());

CREATE POLICY "doctor_hospital_admin_insert" ON doctor
  FOR INSERT TO public
  WITH CHECK (is_hospital_admin() AND hospital_id = get_user_hospital_id());

-- Doctors can read/update their own profile only
CREATE POLICY "doctor_own_profile_read" ON doctor
  FOR SELECT TO public
  USING (is_doctor() AND user_id = auth.uid());

CREATE POLICY "doctor_own_profile_update" ON doctor
  FOR UPDATE TO public
  USING (is_doctor() AND user_id = auth.uid())
  WITH CHECK (is_doctor() AND user_id = auth.uid());

-- Block unauthorized operations
CREATE POLICY "doctor_block_unauthorized_insert" ON doctor
  FOR INSERT TO public
  WITH CHECK (is_super_admin() OR is_hospital_admin());

CREATE POLICY "doctor_block_unauthorized_delete" ON doctor
  FOR DELETE TO public
  USING (is_super_admin());

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'doctor' 
AND column_name IN ('role', 'hospital_id');

-- Check populated data
SELECT 
  d.id,
  d.first_name,
  d.last_name,
  d.role,
  d.hospital_id,
  h.name as hospital_name
FROM doctor d
LEFT JOIN hospital h ON d.hospital_id = h.id
ORDER BY d.id;

-- =====================================================
-- DOCTOR TABLE COLUMNS ADDED ✅
-- =====================================================
-- ✅ role column added with user_role enum
-- ✅ hospital_id column added with foreign key
-- ✅ Columns populated from auth metadata
-- ✅ Helper functions updated to use doctor table
-- ✅ RLS policies updated to use doctor table columns
-- =====================================================
