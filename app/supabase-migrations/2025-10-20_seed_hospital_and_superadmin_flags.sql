-- =====================================================
-- Seed Feature Flags for hospitalAdmin
-- Safe/idempotent: relies on existing schema from create_feature_flags.sql
-- - Inserts/updates feature_flags by key (ON CONFLICT)
-- - Upserts role_feature_flags mappings (ON CONFLICT)
-- - SuperAdmin has all access by default (no feature flags needed)
-- =====================================================

-- Hospital Admin flags only
WITH upsert_flags AS (
  INSERT INTO public.feature_flags (name, key, description, status, is_enabled_by_default, metadata)
  VALUES
    ('Manage Doctors',              'hospital_admin_manage_doctors',          'Add/Update/Deactivate doctors within own hospital', 'active', TRUE,  '{}'::jsonb),
    ('View Doctors',                'hospital_admin_view_doctors',            'View doctors list and profiles',                      'active', TRUE,  '{}'::jsonb),
    ('View Encounters',             'hospital_admin_view_encounters',         'View encounters in own hospital',                     'active', TRUE,  '{}'::jsonb),
    ('Analytics - Encounters',     'hospital_admin_analytics_encounters',    'View encounters analytics for own hospital',          'active', TRUE,  '{}'::jsonb),
    ('Analytics - Costs/Tools',    'hospital_admin_analytics_costs_tools',   'View costs and tool usage for own hospital',          'active', TRUE,  '{}'::jsonb)
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        is_enabled_by_default = EXCLUDED.is_enabled_by_default,
        metadata = EXCLUDED.metadata
  RETURNING id
)
INSERT INTO public.role_feature_flags (role, feature_flag_id, is_enabled)
SELECT 'hospitalAdmin', id, TRUE FROM upsert_flags
ON CONFLICT (role, feature_flag_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- Ensure hospital admin flags remain active
UPDATE public.feature_flags
SET status = 'active'
WHERE key IN (
  'hospital_admin_manage_doctors',
  'hospital_admin_view_doctors',
  'hospital_admin_view_encounters',
  'hospital_admin_analytics_encounters',
  'hospital_admin_analytics_costs_tools'
);

-- Done

