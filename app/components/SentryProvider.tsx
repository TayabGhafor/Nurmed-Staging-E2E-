"use client";

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Set up global error handlers
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      Sentry.captureException(event.reason, {
        tags: {
          errorType: 'unhandled_promise_rejection'
        }
      });
    };

    const handleError = (event: ErrorEvent) => {
      Sentry.captureException(event.error, {
        tags: {
          errorType: 'unhandled_error'
        }
      });
    };

    // Add global error listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Initialize Sentry on the client side
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Add optional integrations for additional features
      integrations: [
        Sentry.browserTracingIntegration(),
        // Send console.log, console.warn, and console.error calls as logs to Sentry
        Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
        // Add feedback widget integration
        Sentry.feedbackIntegration({
          colorScheme: "system",
          triggerLabel: "",
          submitButtonLabel: "Send Report",
          formTitle: "Report a Bug",
          messagePlaceholder: "What's the bug? What did you expect?",
        }),
      ],

      // Production-optimized sampling rates
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Enable logs to be sent to Sentry
      enableLogs: true,

      // Disable replay for now to avoid issues
      // replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.1,
      // replaysOnErrorSampleRate: 1.0,

      // Enhanced error filtering for healthcare app
      beforeSend(event, hint) {
        // Filter out non-critical errors in production
        if (process.env.NODE_ENV === 'production') {
          // Don't capture network errors for offline users
          if (event.exception) {
            const error = hint.originalException;
            if (error instanceof TypeError && error.message.includes('fetch')) {
              return null;
            }
          }
        }
        return event;
      },

      // Add user context for better debugging
      initialScope: {
        tags: {
          component: 'nurmed-frontend',
          environment: process.env.NODE_ENV,
        },
      },

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: process.env.NODE_ENV === 'development',
    });

    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <>{children}</>;
}