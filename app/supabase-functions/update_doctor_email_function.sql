-- =====================================================
-- CREATE UPDATE_DOCTOR_EMAIL FUNCTION
-- =====================================================
-- This function updates email in both the doctor table and auth.users
-- when a doctor's email is changed
-- =====================================================

-- Function to update doctor email in both tables
CREATE OR REPLACE FUNCTION update_doctor_email(
  p_doctor_id INTEGER,
  p_new_email TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_old_email TEXT;
BEGIN
  -- Get the user_id and current email from doctor table
  SELECT user_id, email INTO v_user_id, v_old_email
  FROM doctor 
  WHERE id = p_doctor_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Doctor not found with id: %', p_doctor_id;
  END IF;
  
  -- Check if new email is different
  IF v_old_email = p_new_email THEN
    RETURN TRUE; -- No change needed
  END IF;
  
  -- Check if new email already exists for another user
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_new_email 
    AND id != v_user_id
  ) THEN
    RAISE EXCEPTION 'Email already exists: %', p_new_email;
  END IF;
  
  -- Update email in auth.users table
  UPDATE auth.users 
  SET email = p_new_email
  WHERE id = v_user_id;
  
  -- Update email in doctor table
  UPDATE doctor 
  SET email = p_new_email
  WHERE id = p_doctor_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating doctor email: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_doctor_email(INTEGER, TEXT) TO authenticated;

-- =====================================================
-- EXAMPLE USAGE
-- =====================================================
-- SELECT update_doctor_email(123, 'newemail@example.com');
