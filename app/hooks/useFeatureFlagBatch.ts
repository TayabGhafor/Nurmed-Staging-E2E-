/**
 * useFeatureFlagBatch Hook
 * 
 * An optimized hook for checking multiple features at once using a single API call.
 * This is more efficient than checking features individually.
 * 
 * Usage:
 * const { features, isLoading } = useFeatureFlagBatch([
 *   FeatureKeys.CREATE_RECORDING,
 *   FeatureKeys.AI_COPILOT,
 *   FeatureKeys.EHR_INTEGRATION
 * ]);
 */

import { useState, useEffect } from 'react';
import { FeatureKeys } from '../types/feature-flags';

interface UseFeatureFlagBatchResult {
  features: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFeatureFlagBatch(featureKeys: (string | FeatureKeys)[]): UseFeatureFlagBatchResult {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    if (featureKeys.length === 0) {
      setFeatures({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/feature-flags/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feature_keys: featureKeys,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check features: ${response.statusText}`);
      }

      const data = await response.json();
      setFeatures(data.features || {});
    } catch (err: any) {
      console.error('Error checking feature flags batch:', err);
      setError(err.message || 'Failed to check feature flags');
      // Set all features to false on error
      setFeatures(featureKeys.reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(featureKeys)]); // Stringify to compare array contents

  return {
    features,
    isLoading,
    error,
    refetch: fetchFeatures,
  };
}

