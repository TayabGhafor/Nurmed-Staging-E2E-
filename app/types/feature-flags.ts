// =====================================================
// FEATURE FLAGS TYPES AND INTERFACES
// =====================================================

export type FeatureStatus = 'active' | 'inactive' | 'deprecated';
export type FeatureSource = 'user' | 'hospital' | 'role' | 'default';

export interface FeatureFlag {
  id: number;
  name: string;
  key: string;
  description?: string;
  status: FeatureStatus;
  is_enabled_by_default: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureFlag {
  id: number;
  user_id: string;
  feature_flag_id: number;
  is_enabled: boolean;
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RoleFeatureFlag {
  id: number;
  role: string;
  feature_flag_id: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HospitalFeatureFlag {
  id: number;
  hospital_id: number;
  feature_flag_id: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserFeature {
  feature_key: string;
  feature_name: string;
  is_enabled: boolean;
  source: FeatureSource;
}

// Known feature keys for type safety
export enum FeatureKeys {
  CREATE_SESSION = 'create_session',
  VIEW_SESSIONS = 'view_sessions',
  GENERATE_NOTES = 'generate_notes',
  EDIT_NOTES = 'edit_notes',
  VIEW_TRANSCRIPTIONS = 'view_transcriptions',
  AI_COPILOT = 'ai_copilot',
  EHR_INTEGRATION = 'ehr_integration',
  CODING_SUGGESTIONS = 'coding_suggestions',
  ADMINISTRATION_AI = 'administration_ai',
  EXPORT_DATA = 'export_data',
  MULTI_LANGUAGE_SUPPORT = 'multi_language_support',
  CUSTOM_TEMPLATES = 'custom_templates',
}

// API Response types
export interface CheckFeatureResponse {
  has_access: boolean;
  feature_key: string;
  source?: FeatureSource;
}

export interface GetUserFeaturesResponse {
  features: UserFeature[];
  total: number;
}

export interface GrantFeatureAccessRequest {
  user_id: string;
  feature_key: string;
  is_enabled: boolean;
  expires_at?: string;
}

export interface GrantFeatureAccessResponse {
  success: boolean;
  message: string;
  data?: UserFeatureFlag;
}

