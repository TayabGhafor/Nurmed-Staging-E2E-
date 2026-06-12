-- =====================================================
-- CLEANUP DUPLICATE FUNCTIONS
-- =====================================================
-- Run this to fix the "function set_user_role is not unique" error
-- =====================================================

-- Drop all existing set_user_role functions
DROP FUNCTION IF EXISTS set_user_role(TEXT, user_role, INTEGER);
DROP FUNCTION IF EXISTS set_user_role(TEXT, user_role);
DROP FUNCTION IF EXISTS set_user_role(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS set_user_role(TEXT, TEXT);

-- Drop all existing view_user_roles functions
DROP FUNCTION IF EXISTS view_user_roles();

-- Drop conflicting can_access_hospital functions
DROP FUNCTION IF EXISTS can_access_hospital(INTEGER);
DROP FUNCTION IF EXISTS can_access_hospital(BIGINT);

-- =====================================================
-- CLEANUP COMPLETE ✅
-- =====================================================
-- Now run the 99_set_user_roles.sql script again
-- =====================================================
