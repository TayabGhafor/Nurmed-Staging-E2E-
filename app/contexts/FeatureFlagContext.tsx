"use client";

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserFeature } from '../types/feature-flags';
import { useAuth } from './AuthContext';
import { featureFlagsAPI } from '../kyClient/featureFlags';

interface FeatureFlagContextType {
  features: UserFeature[];
  isLoading: boolean;
  error: string | null;
  hasFeature: (featureKey: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

export const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<UserFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState<boolean>(false);
  const [hasSuccessfulFetch, setHasSuccessfulFetch] = useState(false);

  const fetchFeatures = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const userFeatures = await featureFlagsAPI.getUserFeatures(user.id);
      
      setSystemEnabled(true);
      setFeatures(userFeatures);
      setHasSuccessfulFetch(true);
    } catch (err: any) {
      console.error('Error fetching feature flags:', err);
      setError(err.message || 'Failed to fetch feature flags');
      
      if (!hasSuccessfulFetch) {
        setSystemEnabled(false);
        setFeatures([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasSuccessfulFetch, user?.id]);

  // Initial fetch on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      fetchFeatures();
    }
  }, [fetchFeatures, user?.id]);

  // Check if user has access to a feature
  const hasFeature = useCallback((featureKey: string): boolean => {
    // If system is disabled (not initialized or pre-migration), ALLOW ALL (bypass feature flag checks)
    if (!systemEnabled) {
      return true;
    }
    
    // System is enabled - check the feature properly
    const feature = features.find(f => f.feature_key === featureKey);
    // SECURE DEFAULT: If feature not found, DENY access
    return feature?.is_enabled ?? false;
  }, [features, systemEnabled]);

  // Manual refresh function
  const refreshFeatures = useCallback(async () => {
    await fetchFeatures();
  }, [fetchFeatures]);

  const value: FeatureFlagContextType = {
    features,
    isLoading,
    error,
    hasFeature,
    refreshFeatures,
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
};
