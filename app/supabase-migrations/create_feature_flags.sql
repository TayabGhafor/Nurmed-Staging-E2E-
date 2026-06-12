-- =====================================================
-- FEATURE FLAGS SYSTEM - COMPLETE MIGRATION
-- =====================================================
-- This creates a complete feature flag system for nurmed-app
-- Allows enabling/disabling features for specific users or roles
-- =====================================================

-- Create enum for feature flag status
DO $$ BEGIN
    CREATE TYPE feature_status AS ENUM ('active', 'inactive', 'deprecated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    status feature_status DEFAULT 'active',
    is_enabled_by_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_feature_flags table (for user-specific overrides)
CREATE TABLE IF NOT EXISTS public.user_feature_flags (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_flag_id INTEGER REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature_flag_id)
);

-- Create role_feature_flags table (for role-based flags)
CREATE TABLE IF NOT EXISTS public.role_feature_flags (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL,
    feature_flag_id INTEGER REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, feature_flag_id)
);

-- Create hospital_feature_flags table (for hospital-specific flags)
CREATE TABLE IF NOT EXISTS public.hospital_feature_flags (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER REFERENCES public.hospital(id) ON DELETE CASCADE,
    feature_flag_id INTEGER REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hospital_id, feature_flag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user_id ON public.user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_feature_flag_id ON public.user_feature_flags(feature_flag_id);
CREATE INDEX IF NOT EXISTS idx_role_feature_flags_role ON public.role_feature_flags(role);
CREATE INDEX IF NOT EXISTS idx_role_feature_flags_feature_flag_id ON public.role_feature_flags(feature_flag_id);
CREATE INDEX IF NOT EXISTS idx_hospital_feature_flags_hospital_id ON public.hospital_feature_flags(hospital_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON public.feature_flags(status);

-- Create or replace function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS feature_flags_updated_at_trigger ON public.feature_flags;
CREATE TRIGGER feature_flags_updated_at_trigger
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

DROP TRIGGER IF EXISTS user_feature_flags_updated_at_trigger ON public.user_feature_flags;
CREATE TRIGGER user_feature_flags_updated_at_trigger
    BEFORE UPDATE ON public.user_feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

DROP TRIGGER IF EXISTS role_feature_flags_updated_at_trigger ON public.role_feature_flags;
CREATE TRIGGER role_feature_flags_updated_at_trigger
    BEFORE UPDATE ON public.role_feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

DROP TRIGGER IF EXISTS hospital_feature_flags_updated_at_trigger ON public.hospital_feature_flags;
CREATE TRIGGER hospital_feature_flags_updated_at_trigger
    BEFORE UPDATE ON public.hospital_feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

-- =====================================================
-- STORED PROCEDURES FOR FEATURE FLAG CHECKS
-- =====================================================

-- Function to check if a user has access to a feature
CREATE OR REPLACE FUNCTION check_user_feature_access(
    p_user_id UUID,
    p_feature_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_feature_id INTEGER;
    v_is_enabled BOOLEAN;
    v_default_enabled BOOLEAN;
    v_user_roles TEXT[];
    v_hospital_id INTEGER;
    v_role_enabled BOOLEAN;
    v_hospital_enabled BOOLEAN;
BEGIN
    -- Get feature flag details
    SELECT id, is_enabled_by_default
    INTO v_feature_id, v_default_enabled
    FROM public.feature_flags
    WHERE key = p_feature_key AND status = 'active';

    -- If feature doesn't exist or is not active, return false
    IF v_feature_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check user-specific override (highest priority)
    SELECT is_enabled INTO v_is_enabled
    FROM public.user_feature_flags
    WHERE user_id = p_user_id 
    AND feature_flag_id = v_feature_id
    AND (expires_at IS NULL OR expires_at > NOW());

    IF v_is_enabled IS NOT NULL THEN
        RETURN v_is_enabled;
    END IF;

    -- Get user's roles and hospital_id
    SELECT 
        CASE 
            WHEN raw_user_meta_data->'role' IS NULL THEN ARRAY[]::text[]
            WHEN jsonb_typeof(raw_user_meta_data->'role') = 'array' THEN 
                ARRAY(SELECT jsonb_array_elements_text(raw_user_meta_data->'role'))
            ELSE 
                ARRAY[raw_user_meta_data->>'role']
        END,
        (SELECT hospital_id FROM public.doctor WHERE user_id = p_user_id LIMIT 1)
    INTO v_user_roles, v_hospital_id
    FROM auth.users
    WHERE id = p_user_id;

    -- Check hospital-specific override
    IF v_hospital_id IS NOT NULL THEN
        SELECT is_enabled INTO v_hospital_enabled
        FROM public.hospital_feature_flags
        WHERE hospital_id = v_hospital_id 
        AND feature_flag_id = v_feature_id;

        IF v_hospital_enabled IS NOT NULL THEN
            RETURN v_hospital_enabled;
        END IF;
    END IF;

    -- Check role-based access
    IF v_user_roles IS NOT NULL AND array_length(v_user_roles, 1) > 0 THEN
        SELECT is_enabled INTO v_role_enabled
        FROM public.role_feature_flags
        WHERE role = ANY(v_user_roles)
        AND feature_flag_id = v_feature_id
        LIMIT 1;

        IF v_role_enabled IS NOT NULL THEN
            RETURN v_role_enabled;
        END IF;
    END IF;

    -- Return default setting
    RETURN v_default_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all features for a user
CREATE OR REPLACE FUNCTION get_user_features(p_user_id UUID)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    is_enabled BOOLEAN,
    source TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_info AS (
        SELECT 
            p_user_id as uid,
            (
                SELECT CASE 
                    WHEN raw_user_meta_data->'role' IS NULL THEN ARRAY[]::text[]
                    WHEN jsonb_typeof(raw_user_meta_data->'role') = 'array' THEN 
                        ARRAY(SELECT jsonb_array_elements_text(raw_user_meta_data->'role'))
                    ELSE 
                        ARRAY[raw_user_meta_data->>'role']
                END
                FROM auth.users WHERE id = p_user_id
            ) as roles,
            (SELECT hospital_id FROM public.doctor WHERE user_id = p_user_id LIMIT 1) as hospital_id
    ),
    active_features AS (
        SELECT id, key, name, is_enabled_by_default
        FROM public.feature_flags
        WHERE status = 'active'
    )
    SELECT 
        af.key as feature_key,
        af.name as feature_name,
        COALESCE(
            uff.is_enabled,
            hff.is_enabled,
            rff.is_enabled,
            af.is_enabled_by_default
        ) as is_enabled,
        CASE 
            WHEN uff.is_enabled IS NOT NULL THEN 'user'
            WHEN hff.is_enabled IS NOT NULL THEN 'hospital'
            WHEN rff.is_enabled IS NOT NULL THEN 'role'
            ELSE 'default'
        END as source
    FROM active_features af
    CROSS JOIN user_info ui
    LEFT JOIN public.user_feature_flags uff 
        ON uff.user_id = ui.uid 
        AND uff.feature_flag_id = af.id
        AND (uff.expires_at IS NULL OR uff.expires_at > NOW())
    LEFT JOIN public.hospital_feature_flags hff 
        ON hff.hospital_id = ui.hospital_id 
        AND hff.feature_flag_id = af.id
    LEFT JOIN public.role_feature_flags rff 
        ON rff.role = ANY(ui.roles)
        AND rff.feature_flag_id = af.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.feature_flags TO public;
GRANT ALL ON public.feature_flags TO service_role;
GRANT ALL ON public.user_feature_flags TO public;
GRANT ALL ON public.user_feature_flags TO service_role;
GRANT ALL ON public.role_feature_flags TO public;
GRANT ALL ON public.role_feature_flags TO service_role;
GRANT ALL ON public.hospital_feature_flags TO public;
GRANT ALL ON public.hospital_feature_flags TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.feature_flags_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.feature_flags_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_feature_flags_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.user_feature_flags_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.role_feature_flags_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.role_feature_flags_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hospital_feature_flags_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE public.hospital_feature_flags_id_seq TO service_role;

-- =====================================================
-- SEED DATA FOR COMMON DOCTOR FEATURES
-- =====================================================

-- Insert features for doctor role
INSERT INTO public.feature_flags (name, key, description, is_enabled_by_default, status) VALUES
    ('Create Session', 'create_session', 'Ability to create new patient sessions and recordings', true, 'active'),
    ('View Sessions', 'view_sessions', 'Ability to view patient sessions', true, 'active'),
    ('Generate Notes', 'generate_notes', 'Ability to generate clinical notes from recordings', true, 'active'),
    ('Edit Notes', 'edit_notes', 'Ability to edit generated clinical notes', true, 'active'),
    ('View Transcriptions', 'view_transcriptions', 'Ability to view audio transcriptions', true, 'active'),
    ('AI Copilot', 'ai_copilot', 'Access to AI copilot assistant', true, 'active'),
    ('EHR Integration', 'ehr_integration', 'Ability to send data to EHR system', true, 'active'),
    ('Coding Suggestions', 'coding_suggestions', 'Access to ICD-10 coding suggestions', true, 'active'),
    ('Administration AI', 'administration_ai', 'Access to administrative AI features', true, 'active'),
    ('Export Data', 'export_data', 'Ability to export patient data', true, 'active'),
    ('Multi-language Support', 'multi_language_support', 'Support for multiple languages in transcription', true, 'active'),
    ('Custom Templates', 'custom_templates', 'Create and use custom note templates', true, 'active')
ON CONFLICT (key) DO NOTHING;

-- Enable all features for doctor role by default
INSERT INTO public.role_feature_flags (role, feature_flag_id, is_enabled)
SELECT 
    'doctor',
    id,
    true
FROM public.feature_flags
WHERE key IN (
    'create_session',
    'view_sessions',
    'generate_notes',
    'edit_notes',
    'view_transcriptions',
    'ai_copilot',
    'ehr_integration',
    'coding_suggestions',
    'administration_ai',
    'export_data',
    'multi_language_support',
    'custom_templates'
)
ON CONFLICT (role, feature_flag_id) DO NOTHING;

-- Enable all features for superAdmin role
INSERT INTO public.role_feature_flags (role, feature_flag_id, is_enabled)
SELECT 
    'superAdmin',
    id,
    true
FROM public.feature_flags
ON CONFLICT (role, feature_flag_id) DO NOTHING;

-- Enable all features for hospitalAdmin role
INSERT INTO public.role_feature_flags (role, feature_flag_id, is_enabled)
SELECT 
    'hospitalAdmin',
    id,
    true
FROM public.feature_flags
ON CONFLICT (role, feature_flag_id) DO NOTHING;

-- =====================================================
-- FEATURE FLAGS SYSTEM CREATED ✅
-- =====================================================
