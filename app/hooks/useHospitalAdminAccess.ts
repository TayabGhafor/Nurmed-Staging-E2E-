import { useMemo, useEffect, useRef } from 'react';
import { useFeatureFlags } from './useFeatureFlags';

export interface HospitalAdminCapabilities {
  canManageDoctors: boolean;
  canViewDoctors: boolean;
  canViewEncounters: boolean;
  canViewAnalytics: boolean;
  canViewCostsTools: boolean;
}

export function useHospitalAdminAccess() {
  const { hasFeature, isLoading } = useFeatureFlags();
  const hasLoggedRef = useRef(false);

  const capabilities: HospitalAdminCapabilities = useMemo(() => ({
    canManageDoctors: hasFeature('hospital_admin_manage_doctors'),
    canViewDoctors: hasFeature('hospital_admin_view_doctors'),
    canViewEncounters: hasFeature('hospital_admin_view_encounters'),
    canViewAnalytics: hasFeature('hospital_admin_analytics_encounters'),
    canViewCostsTools: hasFeature('hospital_admin_analytics_costs_tools'),
  }), [hasFeature]);

  // Log only once when permissions are first loaded
  useEffect(() => {
    if (!isLoading && !hasLoggedRef.current) {
      console.log('[Hospital Admin Access] Permissions loaded:', {
        canManageDoctors: capabilities.canManageDoctors,
        canViewDoctors: capabilities.canViewDoctors,
        canViewEncounters: capabilities.canViewEncounters,
        canViewAnalytics: capabilities.canViewAnalytics,
        canViewCostsTools: capabilities.canViewCostsTools,
        hasAnyAccess: Object.values(capabilities).some(Boolean),
      });
      hasLoggedRef.current = true;
    }
  }, [isLoading, capabilities.canManageDoctors, capabilities.canViewDoctors, capabilities.canViewEncounters, capabilities.canViewAnalytics, capabilities.canViewCostsTools]);

  return {
    capabilities,
    loading: isLoading,
    // Helper functions for common checks
    canAccess: (feature: keyof HospitalAdminCapabilities) => capabilities[feature],
    hasAnyAccess: () => Object.values(capabilities).some(Boolean),
  };
}
