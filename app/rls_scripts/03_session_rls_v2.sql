-- =====================================================
-- SESSION TABLE RLS POLICIES (WITH CUSTOM ROLES)
-- =====================================================
-- Run this AFTER 00_setup_roles_and_functions.sql
-- =====================================================

-- Enable RLS on session table
ALTER TABLE session ENABLE ROW LEVEL SECURITY;

-- Policy: Service role bypass (backend continues working)
CREATE POLICY "session_service_role_bypass" ON session
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Super admin can do everything
CREATE POLICY "session_super_admin_all" ON session
  FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Policy: Hospital admin can access sessions from their hospital
CREATE POLICY "session_hospital_admin_read" ON session
  FOR SELECT TO public
  USING (
    is_hospital_admin() AND EXISTS (
      SELECT 1 FROM doctor d 
      WHERE d.id = session.doctor_id 
      AND d.hospital_id = get_user_hospital_id()
    )
  );

CREATE POLICY "session_hospital_admin_update" ON session
  FOR UPDATE TO public
  USING (
    is_hospital_admin() AND EXISTS (
      SELECT 1 FROM doctor d 
      WHERE d.id = session.doctor_id 
      AND d.hospital_id = get_user_hospital_id()
    )
  )
  WITH CHECK (
    is_hospital_admin() AND EXISTS (
      SELECT 1 FROM doctor d 
      WHERE d.id = session.doctor_id 
      AND d.hospital_id = get_user_hospital_id()
    )
  );

-- Policy: Doctors can manage their own sessions
CREATE POLICY "session_doctor_own" ON session
  FOR ALL TO public
  USING (is_doctor() AND doctor_id = get_current_doctor_id())
  WITH CHECK (is_doctor() AND doctor_id = get_current_doctor_id());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON session TO public;
GRANT ALL ON session TO service_role;

-- =====================================================
-- SESSION TABLE RLS - ENABLED ✅
-- =====================================================
-- superAdmin: ✅ Full access to all sessions
-- hospitalAdmin: ✅ Can access sessions from their hospital
-- doctor: ✅ Can manage own sessions only
-- Backend: ✅ Full access via service role
-- =====================================================
