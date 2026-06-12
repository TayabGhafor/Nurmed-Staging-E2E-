-- =====================================================
-- SET USER ROLES - EXAMPLE SCRIPT
-- =====================================================
-- Use this to set roles for your users
-- Modify the emails and roles as needed
-- =====================================================

-- Function to set user role and hospital (if needed)
CREATE OR REPLACE FUNCTION set_user_role(
  user_email TEXT,
  new_role user_role,
  hospital_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
  current_metadata JSONB;
  updated_metadata JSONB;
BEGIN
  -- Find user by email
  SELECT id, raw_user_meta_data INTO user_id, current_metadata
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', user_email;
    RETURN FALSE;
  END IF;
  
  -- Prepare updated metadata
  updated_metadata := COALESCE(current_metadata, '{}'::jsonb);
  updated_metadata := updated_metadata || jsonb_build_object('role', new_role::text);
  
  -- Add hospital_id for hospitalAdmin
  IF new_role = 'hospitalAdmin' AND hospital_id IS NOT NULL THEN
    updated_metadata := updated_metadata || jsonb_build_object('hospital_id', hospital_id);
  END IF;
  
  -- Update user metadata
  UPDATE auth.users 
  SET raw_user_meta_data = updated_metadata
  WHERE id = user_id;
  
  RAISE NOTICE 'Successfully set role % for user %', new_role, user_email;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- EXAMPLE: SET ROLES FOR YOUR USERS
-- =====================================================
-- Uncomment and modify these as needed:

-- Set super admin
-- SELECT set_user_role('admin@nurmed.ai', 'superAdmin');

-- Set hospital admin for hospital ID 1
-- SELECT set_user_role('hospital.admin@hospital1.com', 'hospitalAdmin', 1);

-- Set regular doctor (default role)
-- SELECT set_user_role('doctor@hospital1.com', 'doctor');

-- =====================================================
-- VIEW CURRENT USER ROLES
-- =====================================================
-- Function to view all users and their roles
CREATE OR REPLACE FUNCTION view_user_roles()
RETURNS TABLE(
  email TEXT,
  role TEXT,
  hospital_id INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'role', 'doctor')::TEXT as role,
    (u.raw_user_meta_data->>'hospital_id')::INTEGER as hospital_id,
    u.created_at
  FROM auth.users u
  ORDER BY u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View all user roles (uncomment to use)
-- SELECT * FROM view_user_roles();

-- =====================================================
-- ROLE MANAGEMENT COMPLETE ✅
-- =====================================================
-- Use set_user_role() to assign roles to users
-- Use view_user_roles() to see current assignments
-- =====================================================
