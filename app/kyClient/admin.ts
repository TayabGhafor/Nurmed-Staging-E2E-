import ApiService from "./api";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  hospital_id: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  scopes: string[];
  metadata?: Record<string, any>;
  key?: string; // Only present when creating a new key (full key, not prefix)
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
  metadata?: Record<string, any>;
}

class AdminService extends ApiService {
  private static instance: AdminService;

  private constructor() {
    super();
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  // Get API keys for a hospital
  async getApiKeys(hospitalId: number): Promise<ApiKey[]> {
    try {
      const response = await this.get<any>(
        `admin/hospitals/${hospitalId}/api-keys`
      );
      
      // Debug logging to help diagnose issues
      console.log("API Keys Response:", response);
      console.log("Response type:", typeof response);
      console.log("Is array:", Array.isArray(response));
      
      // Handle different response formats
      // 1. Direct array (API returns array directly)
      if (Array.isArray(response)) {
        return response as ApiKey[];
      }
      
      // 2. Wrapped in data property
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          return response.data as ApiKey[];
        }
        // Single object wrapped
        return [response.data as ApiKey];
      }
      
      // 3. Try to find array in any property
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const responseObj = response as Record<string, any>;
        for (const key in responseObj) {
          if (Array.isArray(responseObj[key])) {
            return responseObj[key] as ApiKey[];
          }
        }
      }
      
      // 4. If response is the array directly (fallback)
      return (response as ApiKey[]) || [];
    } catch (error: any) {
      console.error("Error in getApiKeys:", error);
      throw new Error(
        error.message || `Failed to fetch API keys for hospital ${hospitalId}`
      );
    }
  }

  // Create a new API key
  async createApiKey(data: CreateApiKeyRequest): Promise<ApiKey> {
    try {
      const response = await this.post<any>("admin/api-keys", data);
      // Handle different response formats
      const responseObj = response as any;
      if (responseObj && (responseObj.id || responseObj.key)) {
        return responseObj as ApiKey;
      } else if (responseObj && responseObj.data) {
        if (responseObj.data.id || responseObj.data.key) {
          return responseObj.data as ApiKey;
        }
      }
      // If response doesn't match expected format, try to return it anyway
      return responseObj as ApiKey;
    } catch (error: any) {
      throw new Error(error.message || "Failed to create API key");
    }
  }

  // Delete an API key
  async deleteApiKey(apiKeyId: string): Promise<void> {
    try {
      await this.delete(`admin/api-keys/${apiKeyId}`);
    } catch (error: any) {
      throw new Error(error.message || "Failed to delete API key");
    }
  }
}

export const adminService = AdminService.getInstance();

