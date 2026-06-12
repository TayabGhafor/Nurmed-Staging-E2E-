import { useAuth } from '../contexts/AuthContext';

export interface SuperAdminCapabilities {
  canManageHospitals: boolean;
  canViewHospitals: boolean;
  canManageDoctors: boolean;
  canViewDoctors: boolean;
  canViewTotalHospitals: boolean;
  canViewTotalDoctors: boolean;
  canViewTotalEncounters: boolean;
  canViewRecentEncounters: boolean;
  canViewAnalyticsByHospital: boolean;
  canViewAnalyticsByDoctor: boolean;
  canViewCostsTools: boolean;
}

export function useSuperAdminAccess() {
  const { user } = useAuth();
  
  // SuperAdmin always has all access
  const isSuperAdmin = user?.role?.includes('superAdmin');
  
  const capabilities: SuperAdminCapabilities = {
    canManageHospitals: !!isSuperAdmin,
    canViewHospitals: !!isSuperAdmin,
    canManageDoctors: !!isSuperAdmin,
    canViewDoctors: !!isSuperAdmin,
    canViewTotalHospitals: !!isSuperAdmin,
    canViewTotalDoctors: !!isSuperAdmin,
    canViewTotalEncounters: !!isSuperAdmin,
    canViewRecentEncounters: !!isSuperAdmin,
    canViewAnalyticsByHospital: !!isSuperAdmin,
    canViewAnalyticsByDoctor: !!isSuperAdmin,
    canViewCostsTools: !!isSuperAdmin,
  };

  return {
    capabilities,
    loading: false,
    // Helper functions for common checks
    canAccess: (feature: keyof SuperAdminCapabilities) => capabilities[feature],
    hasAnyAccess: () => isSuperAdmin,
  };
}
