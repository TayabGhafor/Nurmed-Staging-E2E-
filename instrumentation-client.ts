// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration({
      // Capture more context for healthcare app debugging
      maskAllText: false, // Allow text capture for medical context
      blockAllMedia: false, // Allow media capture for audio debugging
    }),
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

  // Production replay sampling - capture more on errors
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.1,
  replaysOnErrorSampleRate: 1.0,

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
  debug: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
