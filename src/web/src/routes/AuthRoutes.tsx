import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { SecurityMonitor } from '@azure/security-monitor';

import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ResetPassword from '../pages/auth/ResetPassword';
import PublicRoute from './PublicRoute';
import { AUTH_ROUTES } from '../constants/routes.constants';

// Initialize security monitoring
const securityMonitor = new SecurityMonitor({
  enableAuditLogging: true,
  rateLimit: {
    login: 100,
    register: 50,
    resetPassword: 20
  }
});

/**
 * Error fallback component for authentication routes
 */
const AuthErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  useEffect(() => {
    securityMonitor.trackError('AUTH_ROUTE_ERROR', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="auth-error">
      <h2>Authentication Error</h2>
      <p>An error occurred during authentication. Please try again later.</p>
    </div>
  );
};

/**
 * Authentication routes configuration component
 * Implements secure routing with Azure AD B2C integration and MFA support
 */
const AuthRoutes: React.FC = () => {
  const location = useLocation();

  // Monitor route changes for security audit
  useEffect(() => {
    securityMonitor.trackRouteAccess({
      path: location.pathname,
      timestamp: Date.now()
    });
  }, [location]);

  // Error boundary configuration
  const errorBoundaryConfig = {
    FallbackComponent: AuthErrorFallback,
    onError: (error: Error) => {
      securityMonitor.trackError('AUTH_ROUTE_ERROR', {
        error: error.message,
        path: location.pathname,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Routes>
        <Route
          path={AUTH_ROUTES.LOGIN}
          element={
            <PublicRoute path={AUTH_ROUTES.LOGIN}>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path={AUTH_ROUTES.REGISTER}
          element={
            <PublicRoute path={AUTH_ROUTES.REGISTER}>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path={AUTH_ROUTES.RESET_PASSWORD}
          element={
            <PublicRoute path={AUTH_ROUTES.RESET_PASSWORD}>
              <ResetPassword />
            </PublicRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
};

// Add security monitoring decorator
const withSecurityMonitoring = (WrappedComponent: React.FC) => {
  return function WithSecurityMonitoring(props: any) {
    useEffect(() => {
      securityMonitor.startSession({
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });

      return () => {
        securityMonitor.endSession({
          timestamp: Date.now()
        });
      };
    }, []);

    return <WrappedComponent {...props} />;
  };
};

// Export enhanced component with security monitoring
export default withSecurityMonitoring(AuthRoutes);