/**
 * useFeatureFlags Hook
 * 
 * A React hook for checking feature flag access in components.
 * Uses the FeatureFlagContext for state management and caching.
 * 
 * Usage:
 * const { hasFeature, isLoading, features } = useFeatureFlags();
 * const canRecord = hasFeature('create_recording');
 */

import { useContext } from 'react';
import { FeatureFlagContext } from '../contexts/FeatureFlagContext';
import { FeatureKeys } from '../types/feature-flags';

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);

  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }

  return context;
}

/**
 * useFeature Hook
 * 
 * A convenience hook for checking a single feature flag.
 * 
 * Usage:
 * const canRecord = useFeature('create_recording');
 */
export function useFeature(featureKey: string | FeatureKeys): boolean {
  const { hasFeature } = useFeatureFlags();
  return hasFeature(featureKey);
}

/**
 * useFeatureWithLoading Hook
 * 
 * Returns both the feature status and loading state.
 * Useful for showing loading UI while feature flags are being fetched.
 * 
 * Usage:
 * const { hasAccess, isLoading } = useFeatureWithLoading('create_recording');
 */
export function useFeatureWithLoading(featureKey: string | FeatureKeys) {
  const { hasFeature, isLoading } = useFeatureFlags();
  
  return {
    hasAccess: hasFeature(featureKey),
    isLoading,
  };
}

/**
 * useFeatures Hook
 * 
 * Check multiple features at once.
 * Returns an object with each feature key and its status.
 * 
 * Usage:
 * const features = useFeatures(['create_recording', 'view_sessions', 'ai_copilot']);
 * // { create_recording: true, view_sessions: true, ai_copilot: false }
 */
export function useFeatures(featureKeys: (string | FeatureKeys)[]): Record<string, boolean> {
  const { hasFeature } = useFeatureFlags();
  
  return featureKeys.reduce((acc, key) => {
    acc[key] = hasFeature(key);
    return acc;
  }, {} as Record<string, boolean>);
}

