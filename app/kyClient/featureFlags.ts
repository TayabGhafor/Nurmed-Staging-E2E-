import { supabase } from '../lib/supabase';
import ApiService from './api';

export interface UserFeature {
  feature_key: string;
  feature_name: string;
  is_enabled: boolean;
  source: 'user' | 'default';
  id?: string;
  description?: string;
  status?: string;
  user_enabled?: boolean | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: string;
  is_enabled_by_default: boolean;
}

class FeatureFlagsAPI extends ApiService {
  private static instance: FeatureFlagsAPI;

  private constructor() {
    super();
  }

  public static getInstance(): FeatureFlagsAPI {
    if (!FeatureFlagsAPI.instance) {
      FeatureFlagsAPI.instance = new FeatureFlagsAPI();
    }
    return FeatureFlagsAPI.instance;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };
  }

  async listFeatures(status: 'active' | 'inactive' | 'all' = 'active'): Promise<FeatureFlag[]> {
    try {
      const response = await this.get<any>('feature-flags/list');
      
      // Handle different response formats
      // 1. Response has data property (ApiResponse format)
      if (response && response.data) {
        // Check if data has features property
        if (response.data.features && Array.isArray(response.data.features)) {
          return response.data.features as FeatureFlag[];
        }
        // Check if data is the array directly
        if (Array.isArray(response.data)) {
          return response.data as FeatureFlag[];
        }
      }
      
      // 2. Direct object with features property
      if (response && (response as any).features && Array.isArray((response as any).features)) {
        return (response as any).features as FeatureFlag[];
      }
      
      // 3. Response is the array directly
      if (Array.isArray(response)) {
        return response as FeatureFlag[];
      }
      
      // 4. Try to find features array in any property
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const responseObj = response as Record<string, any>;
        for (const key in responseObj) {
          if (Array.isArray(responseObj[key])) {
            return responseObj[key] as FeatureFlag[];
          }
        }
      }
      
      return [];
    } catch (error: any) {
      console.error("Error in listFeatures:", error);
      throw new Error(error.message || "Failed to fetch features");
    }
  }

  async getUserFeatures(userId?: string): Promise<UserFeature[]> {
    const headers = await this.getAuthHeaders();
    const url = userId ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/feature-flags/users?user_id=${userId}` : `apifeature-flags/users`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user features: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.features || [];
  }

  async updateUserFeatures(userId: string, featureKeys: string[]): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch('/api/feature-flags/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        feature_keys: featureKeys
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update user features: ${response.statusText}`);
    }
  }

  async checkFeature(featureKey: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`/api/feature-flags/check?feature=${featureKey}`, { headers });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.enabled || false;
  }

  async checkFeatures(featureKeys: string[]): Promise<Record<string, boolean>> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch('/api/feature-flags/batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ features: featureKeys })
    });
    
    if (!response.ok) {
      return featureKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {});
    }
    
    const data = await response.json();
    return data.features || {};
  }

  // --------- Role-centric helpers ---------
  static HOSPITAL_ADMIN_KEYS = [
    'hospital_admin_manage_doctors',
    'hospital_admin_view_doctors',
    'hospital_admin_view_encounters',
    'hospital_admin_analytics_encounters',
    'hospital_admin_analytics_costs_tools',
  ] as const;


  filterHospitalAdminFeatures(features: FeatureFlag[] | UserFeature[]) {
    return features.filter((f: any) => {
      const key = f.key || f.feature_key;
      return key && key.startsWith('hospital_admin_');
    });
  }

  async getHospitalAdminCapabilities(): Promise<Record<string, boolean>> {
    const keys = [...FeatureFlagsAPI.HOSPITAL_ADMIN_KEYS];
    return this.checkFeatures(keys as unknown as string[]);
  }

  filterDoctorFeatures(features: FeatureFlag[] | UserFeature[]): any[] {
    return features.filter((f: any) => {
      const key = f.key || f.feature_key;
      return key && !key.startsWith('hospital_admin_');
    });
  }
}

export const featureFlagsAPI = FeatureFlagsAPI.getInstance();

