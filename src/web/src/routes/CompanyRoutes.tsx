import React, { Suspense } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { SecurityMonitor } from '@security/monitor';
import { ErrorBoundary } from 'react-error-boundary';
import { RouteAnalytics } from '@analytics/route-tracking';

import PrivateRoute from './PrivateRoute';
import { COMPANY_ROUTES } from '../constants/routes.constants';
import { SecurityLevel, UserRole } from '../types/auth.types';

// Retry logic for lazy loading
const retryImport = <T,>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        if (retries === 0) {
          reject(error);
          return;
        }
        setTimeout(() => {
          retryImport(fn, retries - 1).then(resolve, reject);
        }, 1000);
      });
  });
};

// Lazy loaded components with retry logic
const CompanyDashboard = React.lazy(() => 
  retryImport(() => import('../pages/company/Dashboard'))
);
const DataRequests = React.lazy(() => 
  retryImport(() => import('../pages/company/DataRequests'))
);
const Analytics = React.lazy(() => 
  retryImport(() => import('../pages/company/Analytics'))
);
const Billing = React.lazy(() => 
  retryImport(() => import('../pages/company/Billing'))
);
const Settings = React.lazy(() => 
  retryImport(() => import('../pages/company/Settings'))
);

// Error fallback component
const RouteErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  const securityMonitor = new SecurityMonitor();
  
  React.useEffect(() => {
    securityMonitor.trackRouteError({
      error: error.message,
      timestamp: Date.now(),
      route: window.location.pathname
    });
  }, [error]);

  return (
    <div role="alert">
      <h2>Route Error</h2>
      <p>Please try again later or contact support if the problem persists.</p>
    </div>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div role="status" aria-live="polite">
    <p>Loading...</p>
  </div>
);

/**
 * CompanyRoutes component that defines protected routes for the company portal
 * Implements comprehensive security monitoring, error handling, and analytics
 */
const CompanyRoutes: React.FC = React.memo(() => {
  const location = useLocation();
  const securityMonitor = new SecurityMonitor();
  const routeAnalytics = new RouteAnalytics();

  // Monitor route transitions
  React.useEffect(() => {
    securityMonitor.trackRouteTransition({
      path: location.pathname,
      timestamp: Date.now()
    });
    
    routeAnalytics.trackPageView({
      path: location.pathname,
      portal: 'company'
    });
  }, [location]);

  // Common route props
  const commonRouteProps = {
    allowedRoles: [UserRole.COMPANY] as UserRole[],
    requireMFA: true,
    securityLevel: SecurityLevel.HIGH,
    auditLogging: true
  };

  return (
    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Base company route redirect */}
          <Route
            path={COMPANY_ROUTES.BASE}
            element={<Navigate to={COMPANY_ROUTES.DASHBOARD} replace />}
          />

          {/* Dashboard route */}
          <Route
            path={COMPANY_ROUTES.DASHBOARD}
            element={
              <PrivateRoute
                {...commonRouteProps}
                Component={CompanyDashboard}
              />
            }
          />

          {/* Data requests route */}
          <Route
            path={COMPANY_ROUTES.DATA_REQUESTS}
            element={
              <PrivateRoute
                {...commonRouteProps}
                Component={DataRequests}
              />
            }
          />

          {/* Analytics route */}
          <Route
            path={COMPANY_ROUTES.ANALYTICS}
            element={
              <PrivateRoute
                {...commonRouteProps}
                Component={Analytics}
              />
            }
          />

          {/* Billing route */}
          <Route
            path={COMPANY_ROUTES.BILLING}
            element={
              <PrivateRoute
                {...commonRouteProps}
                Component={Billing}
                securityLevel={SecurityLevel.CRITICAL}
              />
            }
          />

          {/* Settings route */}
          <Route
            path={COMPANY_ROUTES.SETTINGS}
            element={
              <PrivateRoute
                {...commonRouteProps}
                Component={Settings}
              />
            }
          />

          {/* Catch all redirect for invalid company routes */}
          <Route
            path="*"
            element={<Navigate to={COMPANY_ROUTES.DASHBOARD} replace />}
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
});

CompanyRoutes.displayName = 'CompanyRoutes';

export default CompanyRoutes;