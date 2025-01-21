import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { BlockchainProvider } from '@hyperledger/fabric-network';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store } from './store/store';

// Add module declaration for webpack hot module replacement
declare global {
  interface NodeModule {
    hot?: {
      accept(path: string, callback: () => void): void;
    };
  }
}

// Initialize Application Insights for HIPAA-compliant monitoring
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
    autoTrackPageVisitTime: true,
    enableUnhandledPromiseRejectionTracking: true
  }
});

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  // Log error to Application Insights
  appInsights.trackException({ error });

  return (
    <div role="alert" className="error-boundary">
      <h2>Application Error</h2>
      <p>An unexpected error occurred. Our team has been notified.</p>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      )}
    </div>
  );
};

// Initialize monitoring and security services
const initializeServices = () => {
  // Start Application Insights
  appInsights.loadAppInsights();
  appInsights.trackPageView();

  // Set security headers
  const securityHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    const meta = document.createElement('meta');
    meta.httpEquiv = key;
    meta.content = value;
    document.head.appendChild(meta);
  });
};

// Root element configuration
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create root with strict mode and error boundary
const root = ReactDOM.createRoot(rootElement);

// Initialize services before rendering
initializeServices();

// Render application with providers and error boundary
root.render(
  <React.StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        appInsights.trackException({ error });
        console.error('Application Error:', error);
      }}
    >
      <Provider store={store}>
        <BlockchainProvider>
          <App />
        </BlockchainProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Provider store={store}>
            <BlockchainProvider>
              <App />
            </BlockchainProvider>
          </Provider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
}