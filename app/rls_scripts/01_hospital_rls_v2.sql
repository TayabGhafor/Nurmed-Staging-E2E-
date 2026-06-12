-- =====================================================
-- HOSPITAL TABLE RLS POLICIES (WITH CUSTOM ROLES)
-- =====================================================
-- Run this AFTER 00_setup_roles_and_functions.sql
-- =====================================================

-- Enable RLS on hospital table
ALTER TABLE hospital ENABLE ROW LEVEL SECURITY;

-- Policy: Service role bypass (backend continues working)
CREATE POLICY "hospital_service_role_bypass" ON hospital
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Super admin can do everything
CREATE POLICY "hospital_super_admin_all" ON hospital
  FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Policy: Hospital admin can read/update their own hospital
CREATE POLICY "hospital_admin_own" ON hospital
  FOR SELECT TO public
  USING (is_hospital_admin() AND can_access_hospital(id));

CREATE POLICY "hospital_admin_update_own" ON hospital
  FOR UPDATE TO public
  USING (is_hospital_admin() AND can_access_hospital(id))
  WITH CHECK (is_hospital_admin() AND can_access_hospital(id));

-- Policy: Doctors can read their hospital info
CREATE POLICY "hospital_doctor_read" ON hospital
  FOR SELECT TO public
  USING (
    is_doctor() AND EXISTS (
      SELECT 1 FROM doctor d 
      WHERE d.user_id = auth.uid() 
      AND d.hospital_id = hospital.id
    )
  );

-- Policy: All authenticated users can read hospitals (for dropdowns)
CREATE POLICY "hospital_read_for_dropdowns" ON hospital
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Block unauthorized modifications
CREATE POLICY "hospital_block_unauthorized_insert" ON hospital
  FOR INSERT TO public
  WITH CHECK (is_super_admin());

CREATE POLICY "hospital_block_unauthorized_delete" ON hospital
  FOR DELETE TO public
  USING (is_super_admin());

-- Grant permissions
GRANT SELECT ON hospital TO public;
GRANT INSERT, UPDATE, DELETE ON hospital TO public;
GRANT ALL ON hospital TO service_role;

-- =====================================================
-- HOSPITAL TABLE RLS - ENABLED ✅
-- =====================================================
-- superAdmin: ✅ Full access
-- hospitalAdmin: ✅ Can read/update own hospital
-- doctor: ✅ Can read own hospital
-- Backend: ✅ Full access via service role
-- =====================================================
