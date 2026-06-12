-- =====================================================
-- UPDATE SIGNUP PROCESS TO POPULATE DOCTOR COLUMNS
-- =====================================================
-- Run this AFTER 06_add_doctor_columns.sql
-- This ensures new signups populate the role and hospital_id columns
-- =====================================================

-- Function to sync doctor table with auth metadata
CREATE OR REPLACE FUNCTION sync_doctor_with_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update doctor table when auth user metadata changes
  UPDATE doctor 
  SET 
    role = COALESCE(NEW.raw_user_meta_data->>'role', 'doctor')::user_role,
    hospital_id = CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'hospitalAdmin' 
      THEN (NEW.raw_user_meta_data->>'hospital_id')::INTEGER
      ELSE (
        SELECT dh.hospital_id 
        FROM doctor_hospital dh 
        WHERE dh.doctor_id = (
          SELECT d.id FROM doctor d WHERE d.user_id = NEW.id
        )
        LIMIT 1
      )
    END
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync doctor table
DROP TRIGGER IF EXISTS sync_doctor_auth_trigger ON auth.users;
CREATE TRIGGER sync_doctor_auth_trigger
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_doctor_with_auth();

-- Function to create doctor record with proper role and hospital_id
CREATE OR REPLACE FUNCTION create_doctor_with_role(
  p_user_id UUID,
  p_first_name TEXT,
  p_sur_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_registration_number TEXT,
  p_department TEXT,
  p_hospital_id INTEGER,
  p_role user_role DEFAULT 'doctor'
)
RETURNS INTEGER AS $$
DECLARE
  doctor_id INTEGER;
BEGIN
  -- Insert doctor record
  INSERT INTO doctor (
    user_id, first_name, sur_name, last_name, email, 
    registration_number, department, role, hospital_id
  ) VALUES (
    p_user_id, p_first_name, p_sur_name, p_last_name, p_email,
    p_registration_number, p_department, p_role, p_hospital_id
  ) RETURNING id INTO doctor_id;
  
  -- Insert doctor-hospital mapping if not hospital admin
  IF p_role != 'hospitalAdmin' THEN
    INSERT INTO doctor_hospital (doctor_id, hospital_id)
    VALUES (doctor_id, p_hospital_id);
  END IF;
  
  RETURN doctor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update existing doctor records
CREATE OR REPLACE FUNCTION update_doctor_role_and_hospital(
  p_user_id UUID,
  p_role user_role,
  p_hospital_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE doctor 
  SET 
    role = p_role,
    hospital_id = COALESCE(p_hospital_id, hospital_id)
  WHERE user_id = p_user_id;
  
  -- Update auth metadata to match
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', p_role::text) ||
    CASE 
      WHEN p_hospital_id IS NOT NULL 
      THEN jsonb_build_object('hospital_id', p_hospital_id)
      ELSE '{}'::jsonb
    END
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- EXAMPLE USAGE
-- =====================================================

-- Example: Create a new doctor
-- SELECT create_doctor_with_role(
--   'user-uuid-here',
--   'John', 'Dr.', 'Doe', 'john@hospital.com',
--   'REG123', 'Cardiology', 1, 'doctor'
-- );

-- Example: Update existing doctor role
-- SELECT update_doctor_role_and_hospital(
--   'user-uuid-here', 'hospitalAdmin', 1
-- );

-- =====================================================
-- SIGNUP PROCESS UPDATED ✅
-- =====================================================
-- ✅ Trigger created to sync doctor table with auth metadata
-- ✅ Function to create doctor with role and hospital_id
-- ✅ Function to update existing doctor roles
-- ✅ Automatic population of columns on signup
-- =====================================================
