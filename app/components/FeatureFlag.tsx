"use client";

import { ReactNode } from 'react';
import { useFeature, useFeatureWithLoading } from '../hooks/useFeatureFlags';
import { FeatureKeys } from '../types/feature-flags';

/**
 * FeatureFlag Component
 * 
 * Conditionally renders children based on feature flag status.
 * 
 * Usage:
 * <FeatureFlag feature="create_recording">
 *   <CreateRecordingButton />
 * </FeatureFlag>
 * 
 * With fallback:
 * <FeatureFlag feature="ai_copilot" fallback={<div>Feature not available</div>}>
 *   <AICopilotPanel />
 * </FeatureFlag>
 * 
 * With loading state:
 * <FeatureFlag feature="ai_copilot" showLoading loadingText="Checking access...">
 *   <AICopilotPanel />
 * </FeatureFlag>
 */

interface FeatureFlagProps {
  feature: string | FeatureKeys;
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
  loadingText?: string;
  invert?: boolean; // If true, shows children when feature is disabled
}

export const FeatureFlag: React.FC<FeatureFlagProps> = ({
  feature,
  children,
  fallback = null,
  showLoading = false,
  loadingText = 'Loading...',
  invert = false,
}) => {
  const { hasAccess, isLoading } = useFeatureWithLoading(feature);

  // Show loading state if requested
  if (isLoading && showLoading) {
    return <div className="text-sm text-gray-500">{loadingText}</div>;
  }

  // While loading, show children (the context will handle security properly)
  // If system is disabled, hasAccess will be true
  // If system is enabled, hasAccess will be the actual permission
  if (isLoading) {
    return <>{children}</>;
  }

  const shouldShow = invert ? !hasAccess : hasAccess;

  if (shouldShow) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * FeatureGate Component
 * 
 * More opinionated version of FeatureFlag with built-in styling for disabled states.
 * Useful for disabling buttons or interactive elements.
 * 
 * Usage:
 * <FeatureGate feature="create_recording">
 *   {(hasAccess) => (
 *     <button disabled={!hasAccess}>
 *       Create Recording
 *     </button>
 *   )}
 * </FeatureGate>
 */

interface FeatureGateProps {
  feature: string | FeatureKeys;
  children: (hasAccess: boolean) => ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children }) => {
  const hasAccess = useFeature(feature);
  return <>{children(hasAccess)}</>;
};

/**
 * RequireFeature Component
 * 
 * Shows an "Access Denied" message when feature is not available.
 * Useful for entire pages or major sections.
 * 
 * Usage:
 * <RequireFeature feature="advanced_analytics" message="Advanced Analytics is not available in your plan">
 *   <AnalyticsDashboard />
 * </RequireFeature>
 */

interface RequireFeatureProps {
  feature: string | FeatureKeys;
  children: ReactNode;
  message?: string;
  title?: string;
}

export const RequireFeature: React.FC<RequireFeatureProps> = ({
  feature,
  children,
  message = "This feature is not available for your account.",
  title = "Access Denied",
}) => {
  const hasAccess = useFeature(feature);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
