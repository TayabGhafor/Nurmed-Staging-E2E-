-- =====================================================
-- CREATE DEACTIVATE_DOCTOR FUNCTION
-- =====================================================
-- This function deactivates a doctor in both the doctor table and 
-- auth.users raw_user_meta_data when a doctor is deactivated
-- =====================================================

-- Function to deactivate doctor in both tables
CREATE OR REPLACE FUNCTION deactivate_doctor(
  p_doctor_id INTEGER,
  p_is_active BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_current_metadata JSONB;
  v_updated_metadata JSONB;
BEGIN
  -- Get the user_id from doctor table
  SELECT user_id INTO v_user_id
  FROM doctor 
  WHERE id = p_doctor_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Doctor not found with id: %', p_doctor_id;
  END IF;
  
  -- Update is_active status in doctor table
  UPDATE doctor 
  SET is_active = p_is_active
  WHERE id = p_doctor_id;
  
  -- Get current user metadata
  SELECT COALESCE(raw_user_meta_data, '{}'::jsonb) INTO v_current_metadata
  FROM auth.users 
  WHERE id = v_user_id;
  
  -- Update metadata with is_active status
  v_updated_metadata := v_current_metadata || jsonb_build_object('is_active', p_is_active);
  
  -- Update raw_user_meta_data in auth.users table
  UPDATE auth.users 
  SET raw_user_meta_data = v_updated_metadata
  WHERE id = v_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating doctor status: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deactivate_doctor(INTEGER, BOOLEAN) TO authenticated;

-- =====================================================
-- EXAMPLE USAGE
-- =====================================================
-- To deactivate a doctor: SELECT deactivate_doctor(123, false);
-- To activate a doctor: SELECT deactivate_doctor(123, true);