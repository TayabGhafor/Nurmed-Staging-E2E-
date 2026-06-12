/**
 * Feature Flags Utility Functions
 * 
 * Client-side and server-side utilities for working with feature flags
 */

import { FeatureKeys } from '../types/feature-flags';

/**
 * Check if a feature is enabled for the current user (client-side)
 * This is a direct API call, use the hook for components
 */
export async function checkFeatureAccess(featureKey: string | FeatureKeys): Promise<boolean> {
  try {
    const response = await fetch(`/api/feature-flags/check?feature_key=${encodeURIComponent(featureKey)}`);
    
    if (!response.ok) {
      console.error('Failed to check feature access:', response.statusText);
      return false;
    }

    const data = await response.json();
    return data.has_access ?? false;
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
}

/**
 * Get all features for the current user
 */
export async function getUserFeatures() {
  try {
    const response = await fetch('/api/feature-flags/users');
    
    if (!response.ok) {
      console.error('Failed to fetch user features:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.features || [];
  } catch (error) {
    console.error('Error fetching user features:', error);
    return [];
  }
}

/**
 * Get all available feature flags
 */
export async function getAllFeatureFlags(status: 'active' | 'inactive' | 'deprecated' | 'all' = 'active') {
  try {
    const response = await fetch(`/api/feature-flags/list?status=${status}`);
    
    if (!response.ok) {
      console.error('Failed to fetch feature flags:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.features || [];
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return [];
  }
}

/**
 * Check multiple features at once
 * Returns an object with feature keys as keys and boolean values
 */
export async function checkMultipleFeatures(featureKeys: (string | FeatureKeys)[]): Promise<Record<string, boolean>> {
  try {
    const checks = await Promise.all(
      featureKeys.map(async (key) => ({
        key,
        hasAccess: await checkFeatureAccess(key),
      }))
    );

    return checks.reduce((acc, { key, hasAccess }) => {
      acc[key] = hasAccess;
      return acc;
    }, {} as Record<string, boolean>);
  } catch (error) {
    console.error('Error checking multiple features:', error);
    return featureKeys.reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as Record<string, boolean>);
  }
}

/**
 * Feature flag helpers for common operations
 */
export const FeatureFlagHelpers = {
  /**
   * Check if user can create sessions
   */
  canCreateSession: () => checkFeatureAccess(FeatureKeys.CREATE_SESSION),

  /**
   * Check if user can view sessions
   */
  canViewSessions: () => checkFeatureAccess(FeatureKeys.VIEW_SESSIONS),

  /**
   * Check if user can generate notes
   */
  canGenerateNotes: () => checkFeatureAccess(FeatureKeys.GENERATE_NOTES),

  /**
   * Check if user can edit notes
   */
  canEditNotes: () => checkFeatureAccess(FeatureKeys.EDIT_NOTES),

  /**
   * Check if user can view transcriptions
   */
  canViewTranscriptions: () => checkFeatureAccess(FeatureKeys.VIEW_TRANSCRIPTIONS),

  /**
   * Check if user has AI copilot access
   */
  hasAICopilot: () => checkFeatureAccess(FeatureKeys.AI_COPILOT),

  /**
   * Check if user has EHR integration
   */
  hasEHRIntegration: () => checkFeatureAccess(FeatureKeys.EHR_INTEGRATION),

  /**
   * Check if user has coding suggestions
   */
  hasCodingSuggestions: () => checkFeatureAccess(FeatureKeys.CODING_SUGGESTIONS),

  /**
   * Check if user has administration AI
   */
  hasAdministrationAI: () => checkFeatureAccess(FeatureKeys.ADMINISTRATION_AI),

  /**
   * Check if user can export data
   */
  canExportData: () => checkFeatureAccess(FeatureKeys.EXPORT_DATA),

  /**
   * Check if user has multi-language support
   */
  hasMultiLanguageSupport: () => checkFeatureAccess(FeatureKeys.MULTI_LANGUAGE_SUPPORT),

  /**
   * Check if user has custom templates
   */
  hasCustomTemplates: () => checkFeatureAccess(FeatureKeys.CUSTOM_TEMPLATES),
};
