-- =====================================================
-- SETUP CUSTOM ROLES AND HELPER FUNCTIONS
-- =====================================================
-- Run this FIRST before any RLS policies
-- =====================================================

-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('superAdmin', 'hospitalAdmin', 'doctor');

-- Create helper functions for role checking
-- =====================================================

-- Function to get current user's role from metadata
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
  user_metadata jsonb;
  role_value text;
BEGIN
  -- Get user metadata from auth.users
  SELECT raw_user_meta_data INTO user_metadata 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Extract role, default to 'doctor' if not set
  role_value := COALESCE(user_metadata->>'role', 'doctor');
  
  -- Return as enum type
  RETURN role_value::user_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'doctor'::user_role;  -- Safe default
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'superAdmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is hospital admin
CREATE OR REPLACE FUNCTION is_hospital_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'hospitalAdmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is doctor
CREATE OR REPLACE FUNCTION is_doctor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'doctor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's hospital_id from metadata
CREATE OR REPLACE FUNCTION get_user_hospital_id()
RETURNS INTEGER AS $$
DECLARE
  user_metadata jsonb;
BEGIN
  SELECT raw_user_meta_data INTO user_metadata 
  FROM auth.users 
  WHERE id = auth.uid();
  
  RETURN (user_metadata->>'hospital_id')::integer;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's doctor_id
CREATE OR REPLACE FUNCTION get_current_doctor_id()
RETURNS INTEGER AS $$
DECLARE
  doctor_id INTEGER;
BEGIN
  SELECT id INTO doctor_id
  FROM doctor
  WHERE user_id = auth.uid();
  
  RETURN doctor_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access a specific hospital
CREATE OR REPLACE FUNCTION can_access_hospital(hospital_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin can access any hospital
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Hospital admin can access their own hospital
  IF is_hospital_admin() AND get_user_hospital_id() = hospital_id THEN
    RETURN TRUE;
  END IF;
  
  -- Doctor can access their hospital
  IF is_doctor() THEN
    RETURN EXISTS (
      SELECT 1 FROM doctor d
      WHERE d.user_id = auth.uid() 
      AND d.hospital_id = can_access_hospital.hospital_id
    );
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SETUP COMPLETE ✅
-- =====================================================
-- Custom roles created: superAdmin, hospitalAdmin, doctor
-- Helper functions ready for RLS policies
-- Next: Run the individual table RLS scripts
-- =====================================================
