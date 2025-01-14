import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@sentry/react';
import { SecurityMonitor } from '@myelixir/security-monitor';

import PrivateRoute from './PrivateRoute';
import ConsumerDashboard from '../pages/consumer/ConsumerDashboard';
import HealthRecords from '../pages/consumer/HealthRecords';
import Settings from '../pages/consumer/Settings';
import { CONSUMER_ROUTES } from '../constants/routes.constants';

// Security monitoring configuration
const SECURITY_CONFIG = {
  enableAudit: true,
  hipaaCompliant: true,
  mfaRequired: [CONSUMER_ROUTES.HEALTH_RECORDS, CONSUMER_ROUTES.SETTINGS],
  blockchainVerification: true,
  sessionMonitoring: true
} as const;

/**
 * Enhanced consumer routes component with comprehensive security features
 * Implements HIPAA-compliant route protection and monitoring
 */
const ConsumerRoutes: React.FC = () => {
  const location = useLocation();
  const securityMonitor = new SecurityMonitor();

  // Monitor route transitions for security audit
  React.useEffect(() => {
    securityMonitor.trackRouteAccess({
      path: location.pathname,
      timestamp: new Date(),
      requiresMfa: SECURITY_CONFIG.mfaRequired.includes(location.pathname),
      hipaaContext: true
    });
  }, [location.pathname]);

  // Error boundary fallback with security context
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div role="alert" className="error-boundary">
      <h2>Navigation Error</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>
        Retry Navigation
      </button>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error) => {
        securityMonitor.trackError({
          error,
          context: 'consumer_routes',
          path: location.pathname
        });
      }}
    >
      <Routes>
        {/* Dashboard Route */}
        <Route
          path={CONSUMER_ROUTES.DASHBOARD}
          element={
            <PrivateRoute
              Component={ConsumerDashboard}
              allowedRoles={['consumer']}
              requireMFA={false}
              auditLogging={true}
            />
          }
        />

        {/* Health Records Route - Requires MFA */}
        <Route
          path={CONSUMER_ROUTES.HEALTH_RECORDS}
          element={
            <PrivateRoute
              Component={HealthRecords}
              allowedRoles={['consumer']}
              requireMFA={true}
              securityLevel="CRITICAL"
              auditLogging={true}
            />
          }
        />

        {/* Settings Route - Requires MFA */}
        <Route
          path={CONSUMER_ROUTES.SETTINGS}
          element={
            <PrivateRoute
              Component={Settings}
              allowedRoles={['consumer']}
              requireMFA={true}
              securityLevel="HIGH"
              auditLogging={true}
            />
          }
        />

        {/* Record Details Route - Requires MFA */}
        <Route
          path={CONSUMER_ROUTES.RECORD_DETAILS}
          element={
            <PrivateRoute
              Component={HealthRecords}
              allowedRoles={['consumer']}
              requireMFA={true}
              securityLevel="CRITICAL"
              auditLogging={true}
            />
          }
        />

        {/* Consent Management Route */}
        <Route
          path={CONSUMER_ROUTES.CONSENT_MANAGEMENT}
          element={
            <PrivateRoute
              Component={HealthRecords}
              allowedRoles={['consumer']}
              requireMFA={true}
              securityLevel="HIGH"
              auditLogging={true}
            />
          }
        />

        {/* Compensation Route */}
        <Route
          path={CONSUMER_ROUTES.COMPENSATION}
          element={
            <PrivateRoute
              Component={ConsumerDashboard}
              allowedRoles={['consumer']}
              requireMFA={false}
              auditLogging={true}
            />
          }
        />
      </Routes>
    </ErrorBoundary>
  );
};

export default ConsumerRoutes;