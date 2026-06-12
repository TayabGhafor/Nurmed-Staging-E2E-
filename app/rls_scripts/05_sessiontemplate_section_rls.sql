-- =====================================================
-- SESSIONTEMPLATE_SECTION TABLE RLS POLICIES
-- =====================================================
-- This table is a bridge between session templates and sections
-- Used heavily in EHR integration and notes generation
-- =====================================================

-- Enable RLS on sessiontemplate_section table
ALTER TABLE sessiontemplate_section ENABLE ROW LEVEL SECURITY;

-- Policy: Service role bypass (backend continues working)
CREATE POLICY "sessiontemplate_section_service_role_bypass" ON sessiontemplate_section
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Super admin can do everything
CREATE POLICY "sessiontemplate_section_super_admin_all" ON sessiontemplate_section
  FOR ALL TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Policy: All authenticated users can read (needed for EHR and notes)
CREATE POLICY "sessiontemplate_section_read_all" ON sessiontemplate_section
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Policy: Only super admin can modify template sections
CREATE POLICY "sessiontemplate_section_super_admin_insert" ON sessiontemplate_section
  FOR INSERT TO public
  WITH CHECK (is_super_admin());

CREATE POLICY "sessiontemplate_section_super_admin_update" ON sessiontemplate_section
  FOR UPDATE TO public
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "sessiontemplate_section_super_admin_delete" ON sessiontemplate_section
  FOR DELETE TO public
  USING (is_super_admin());

-- Grant permissions
GRANT SELECT ON sessiontemplate_section TO public;
GRANT INSERT, UPDATE, DELETE ON sessiontemplate_section TO public;
GRANT ALL ON sessiontemplate_section TO service_role;

-- =====================================================
-- SESSIONTEMPLATE_SECTION TABLE RLS - ENABLED ✅
-- =====================================================
-- superAdmin: ✅ Full access
-- All users: ✅ Read access (needed for EHR/notes)
-- Backend: ✅ Full access via service role
-- =====================================================
