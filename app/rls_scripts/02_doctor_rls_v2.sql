-- =====================================================
-- DOCTOR TABLE RLS POLICIES (WITH CUSTOM ROLES)
-- =====================================================
-- Run this AFTER 00_setup_roles_and_functions.sql
-- =====================================================

-- Note: can_access_hospital function is defined in 00_setup_roles_and_functions.sql
-- We'll use the existing function from script 00

-- Enable RLS on doctor table
ALTER TABLE doctor ENABLE ROW LEVEL SECURITY;

-- Policy: Service role bypass (backend continues working)
CREATE POLICY "doctor_service_role_bypass" ON doctor
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Super admin can do everything
CREATE POLICY "doctor_super_admin_all" ON doctor
  FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Policy: Hospital admin can manage doctors in their hospital
CREATE POLICY "doctor_hospital_admin_read" ON doctor
  FOR SELECT TO public
  USING (is_hospital_admin() AND can_access_hospital(hospital_id));

CREATE POLICY "doctor_hospital_admin_update" ON doctor
  FOR UPDATE TO public
  USING (is_hospital_admin() AND can_access_hospital(hospital_id))
  WITH CHECK (is_hospital_admin() AND can_access_hospital(hospital_id));

CREATE POLICY "doctor_hospital_admin_insert" ON doctor
  FOR INSERT TO public
  WITH CHECK (is_hospital_admin() AND can_access_hospital(hospital_id));

-- Policy: Doctors can read/update their own profile only
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

-- Grant permissions
GRANT SELECT, UPDATE ON doctor TO public;
GRANT INSERT, DELETE ON doctor TO public;
GRANT ALL ON doctor TO service_role;

-- =====================================================
-- DOCTOR TABLE RLS - ENABLED ✅
-- =====================================================
-- superAdmin: ✅ Full access
-- hospitalAdmin: ✅ Can manage doctors in their hospital
-- doctor: ✅ Can read/update own profile only
-- Backend: ✅ Full access via service role
-- =====================================================
