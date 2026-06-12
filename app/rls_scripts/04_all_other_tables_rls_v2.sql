-- =====================================================
-- ALL OTHER TABLES RLS POLICIES (WITH CUSTOM ROLES)
-- =====================================================
-- Run this AFTER 00_setup_roles_and_functions.sql
-- Covers: doctor_hospital, sessionsectiondata, conversation, section, sessiontemplate
-- =====================================================

-- =====================================================
-- DOCTOR_HOSPITAL TABLE
-- =====================================================
ALTER TABLE doctor_hospital ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "doctor_hospital_service_role_bypass" ON doctor_hospital
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin full access
CREATE POLICY "doctor_hospital_super_admin_all" ON doctor_hospital
  FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Hospital admin can manage mappings for their hospital
CREATE POLICY "doctor_hospital_admin_manage" ON doctor_hospital
  FOR ALL TO public 
  USING (is_hospital_admin() AND can_access_hospital(hospital_id))
  WITH CHECK (is_hospital_admin() AND can_access_hospital(hospital_id));

-- Doctors can read their own mappings
CREATE POLICY "doctor_hospital_doctor_read" ON doctor_hospital
  FOR SELECT TO public 
  USING (is_doctor() AND doctor_id = get_current_doctor_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_hospital TO public;
GRANT ALL ON doctor_hospital TO service_role;

-- =====================================================
-- SESSIONSECTIONDATA TABLE  
-- =====================================================
ALTER TABLE sessionsectiondata ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "sessionsectiondata_service_role_bypass" ON sessionsectiondata
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin full access
CREATE POLICY "sessionsectiondata_super_admin_all" ON sessionsectiondata
  FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Hospital admin can access session data from their hospital
CREATE POLICY "sessionsectiondata_hospital_admin" ON sessionsectiondata
  FOR ALL TO public 
  USING (
    is_hospital_admin() AND session_id IN (
      SELECT s.id FROM session s 
      INNER JOIN doctor d ON s.doctor_id = d.id
      WHERE can_access_hospital(d.hospital_id)
    )
  )
  WITH CHECK (
    is_hospital_admin() AND session_id IN (
      SELECT s.id FROM session s 
      INNER JOIN doctor d ON s.doctor_id = d.id
      WHERE can_access_hospital(d.hospital_id)
    )
  );

-- Doctors can access their own session data
CREATE POLICY "sessionsectiondata_doctor_own" ON sessionsectiondata
  FOR ALL TO public 
  USING (
    is_doctor() AND session_id IN (
      SELECT s.id FROM session s 
      WHERE s.doctor_id = get_current_doctor_id()
    )
  )
  WITH CHECK (
    is_doctor() AND session_id IN (
      SELECT s.id FROM session s 
      WHERE s.doctor_id = get_current_doctor_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON sessionsectiondata TO public;
GRANT ALL ON sessionsectiondata TO service_role;

-- =====================================================
-- CONVERSATION TABLE
-- =====================================================
ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "conversation_service_role_bypass" ON conversation
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin full access
CREATE POLICY "conversation_super_admin_all" ON conversation
  FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Hospital admin can access conversations from their hospital
CREATE POLICY "conversation_hospital_admin" ON conversation
  FOR ALL TO public 
  USING (
    is_hospital_admin() AND session_id IN (
      SELECT s.id FROM session s 
      INNER JOIN doctor d ON s.doctor_id = d.id
      WHERE can_access_hospital(d.hospital_id)
    )
  )
  WITH CHECK (
    is_hospital_admin() AND session_id IN (
      SELECT s.id FROM session s 
      INNER JOIN doctor d ON s.doctor_id = d.id
      WHERE can_access_hospital(d.hospital_id)
    )
  );

-- Doctors can access their own conversations
CREATE POLICY "conversation_doctor_own" ON conversation
  FOR ALL TO public 
  USING (
    is_doctor() AND session_id IN (
      SELECT s.id FROM session s 
      WHERE s.doctor_id = get_current_doctor_id()
    )
  )
  WITH CHECK (
    is_doctor() AND session_id IN (
      SELECT s.id FROM session s 
      WHERE s.doctor_id = get_current_doctor_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON conversation TO public;
GRANT ALL ON conversation TO service_role;

-- =====================================================
-- SECTION TABLE (Template sections - mostly read-only)
-- =====================================================
ALTER TABLE section ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "section_service_role_bypass" ON section
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin full access
CREATE POLICY "section_super_admin_all" ON section
  FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

-- All authenticated users can read sections (needed for templates)
CREATE POLICY "section_read_all" ON section
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- Only super admin can modify sections
CREATE POLICY "section_super_admin_modify" ON section
  FOR INSERT TO public WITH CHECK (is_super_admin());

CREATE POLICY "section_super_admin_update" ON section
  FOR UPDATE TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "section_super_admin_delete" ON section
  FOR DELETE TO public USING (is_super_admin());

GRANT SELECT ON section TO public;
GRANT INSERT, UPDATE, DELETE ON section TO public;
GRANT ALL ON section TO service_role;

-- =====================================================
-- SESSIONTEMPLATE TABLE (Templates - mostly read-only)
-- =====================================================
ALTER TABLE sessiontemplate ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "sessiontemplate_service_role_bypass" ON sessiontemplate
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin full access
CREATE POLICY "sessiontemplate_super_admin_all" ON sessiontemplate
  FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

-- All authenticated users can read templates
CREATE POLICY "sessiontemplate_read_all" ON sessiontemplate
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

-- Only super admin can modify templates
CREATE POLICY "sessiontemplate_super_admin_modify" ON sessiontemplate
  FOR INSERT TO public WITH CHECK (is_super_admin());

CREATE POLICY "sessiontemplate_super_admin_update" ON sessiontemplate
  FOR UPDATE TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sessiontemplate_super_admin_delete" ON sessiontemplate
  FOR DELETE TO public USING (is_super_admin());

GRANT SELECT ON sessiontemplate TO public;
GRANT INSERT, UPDATE, DELETE ON sessiontemplate TO public;
GRANT ALL ON sessiontemplate TO service_role;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =====================================================
-- ALL REMAINING TABLES RLS - ENABLED ✅
-- =====================================================
-- superAdmin: ✅ Full access to everything
-- hospitalAdmin: ✅ Access to their hospital's data
-- doctor: ✅ Access to their own data only
-- Backend: ✅ Full access via service role
-- =====================================================
