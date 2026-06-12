import * as Sentry from "@sentry/nextjs";

// Essential error monitoring for healthcare application
export class SentryMonitoring {
  
  // Track authentication failures
  static trackAuthError(error: Error, context: {
    email?: string;
    action: 'login' | 'logout' | 'password_reset' | 'otp_verification' | 'google_oauth_login' | "signup";
  }) {
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'authentication');
      scope.setTag('auth_action', context.action);
      scope.setContext('auth_context', {
        email: context.email ? context.email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
        action: context.action,
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Track audio recording issues
  static trackAudioError(error: Error, context: {
    sessionId?: string;
    action: 'record' | 'play' | 'upload' | 'encrypt' | 'decrypt';
  }) {
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'audio_processing');
      scope.setTag('audio_action', context.action);
      scope.setContext('audio_context', {
        sessionId: context.sessionId,
        action: context.action,
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Track session management issues
  static trackSessionError(error: Error, context: {
    sessionId?: string;
    action: 'create' | 'update' | 'delete' | 'status_check' | 'data_fetch';
  }) {
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'session_management');
      scope.setTag('session_action', context.action);
      scope.setContext('session_context', {
        sessionId: context.sessionId,
        action: context.action,
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Track API failures
  static trackApiError(error: Error, context: {
    endpoint: string;
    method: string;
    statusCode?: number;
    responseTime?: number;
  }) {
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'api_failure');
      scope.setTag('http_method', context.method);
      scope.setTag('status_code', context.statusCode?.toString() || 'unknown');
      scope.setContext('api_context', {
        endpoint: context.endpoint,
        method: context.method,
        statusCode: context.statusCode,
        responseTime: context.responseTime,
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Track performance issues
  static trackPerformanceIssue(metric: string, value: number) {
    Sentry.withScope((scope) => {
      scope.setTag('metric_type', 'performance');
      scope.setContext('performance_context', {
        metric,
        value,
      });
      scope.setLevel('warning');
      Sentry.captureMessage(`Performance issue: ${metric} = ${value}ms`, 'warning');
    });
  }

  // Track business metrics
  static trackBusinessMetric(metric: string, value: number, context?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message: `Business metric: ${metric}`,
      category: 'business',
      level: 'info',
      data: {
        metric,
        value,
        ...context
      }
    });
  }

  // Track user actions
  static trackUserAction(action: string, context?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message: `User action: ${action}`,
      category: 'user',
      level: 'info',
      data: {
        action,
        ...context
      }
    });
  }

  // Set user context for better debugging
  static setUserContext(user: {
    id: string;
    email: string;
    role: string | string[]; // Can be array or single string
    firstName?: string;
    lastName?: string;
  }) {
    const roleString = Array.isArray(user.role) ? user.role.join(', ') : user.role;
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: `${user.firstName} ${user.lastName}`.trim(),
      role: roleString,
    });
  }
}