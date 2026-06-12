-- =====================================================
-- CREATE UPDATE_DOCTOR_ROLE_AND_HOSPITAL FUNCTION
-- =====================================================
-- This function updates both the doctor table and auth.users metadata
-- when a doctor's role or hospital assignment changes
-- =====================================================

-- First ensure the user_role type exists
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('superAdmin', 'hospitalAdmin', 'doctor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to update existing doctor records
CREATE OR REPLACE FUNCTION update_doctor_role_and_hospital(
  p_user_id UUID,
  p_role TEXT,
  p_hospital_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_metadata JSONB;
BEGIN
  -- Update doctor table first
  UPDATE doctor 
  SET 
    role = p_role::user_role,
    hospital_id = COALESCE(p_hospital_id, hospital_id)
  WHERE user_id = p_user_id;
  
  -- Build the updated metadata
  updated_metadata := COALESCE(
    (SELECT raw_user_meta_data FROM auth.users WHERE id = p_user_id), 
    '{}'::jsonb
  );
  
  -- Add role to metadata
  updated_metadata := updated_metadata || jsonb_build_object('role', p_role);
  
  -- Add hospital_id if provided
  IF p_hospital_id IS NOT NULL THEN
    updated_metadata := updated_metadata || jsonb_build_object('hospital_id', p_hospital_id);
  END IF;
  
  -- Update auth metadata
  UPDATE auth.users 
  SET raw_user_meta_data = updated_metadata
  WHERE id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating doctor role: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_doctor_role_and_hospital(UUID, TEXT, INTEGER) TO authenticated;

-- Test the function exists
SELECT 'Function created successfully' as status;
