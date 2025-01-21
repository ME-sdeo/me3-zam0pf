import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ErrorBoundary } from 'react-error-boundary';

import AppRoutes from './routes';
import { store } from './store';
import { medicalTheme } from './theme';

// Initialize Application Insights for monitoring
const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.REACT_APP_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
    enableAjaxErrorStatusText: true,
    enableAjaxPerfTracking: true,
    maxBatchInterval: 0,
    disableFetchTracking: false,
    disableExceptionTracking: false,
    autoTrackPageVisitTime: true
  }
});

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  useEffect(() => {
    // Log error to Application Insights
    appInsights.trackException({ error });
  }, [error]);

  return (
    <div role="alert" className="error-boundary">
      <h2>Application Error</h2>
      <p>An error occurred in the application. Our team has been notified.</p>
      <p>Please refresh the page to continue.</p>
    </div>
  );
};

/**
 * Root application component that initializes the MyElixir platform
 * Implements comprehensive security monitoring and medical environment optimizations
 */
const App: React.FC = () => {
  // Initialize monitoring and security tracking
  useEffect(() => {
    appInsights.loadAppInsights();
    appInsights.trackPageView();

    // Detect medical environment
    const isMedicalDevice = /medical|healthcare/i.test(navigator.userAgent);
    if (isMedicalDevice) {
      appInsights.trackEvent({ name: 'MedicalDeviceDetected' });
      document.documentElement.setAttribute('data-medical-device', 'true');
    }

    // Monitor performance metrics
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        appInsights.trackMetric({
          name: entry.name,
          average: entry.duration
        });
      });
    });

    observer.observe({ entryTypes: ['navigation', 'resource', 'longtask'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        appInsights.trackException({ error });
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={medicalTheme}>
          <CssBaseline enableColorScheme />
          <div 
            className="app-container"
            role="application"
            aria-label="MyElixir Healthcare Data Marketplace"
          >
            <AppRoutes />
          </div>
        </ThemeProvider>
      </Provider>

      {/* Accessibility enhancements */}
      <div aria-live="polite" className="sr-only" role="status" id="app-announcer" />
      
      <style>
        {`
          :root {
            --app-max-width: 1440px;
            --app-min-height: 100vh;
          }

          .app-container {
            min-height: var(--app-min-height);
            display: flex;
            flex-direction: column;
          }

          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
          }

          /* High contrast mode adjustments */
          @media (prefers-contrast: high) {
            :root {
              --focus-ring-color: currentColor;
              --focus-ring-width: 3px;
            }

            *:focus {
              outline: var(--focus-ring-width) solid var(--focus-ring-color);
              outline-offset: 2px;
            }
          }

          /* Reduced motion preferences */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }

          /* Medical device optimizations */
          [data-medical-device="true"] {
            font-size: 16px;
            line-height: 1.5;
            letter-spacing: 0.5px;
          }
        `}
      </style>
    </ErrorBoundary>
  );
};

export default App;