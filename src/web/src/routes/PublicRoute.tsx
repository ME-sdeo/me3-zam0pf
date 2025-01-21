import React, { useEffect } from 'react';  // react ^18.0.0
import { Navigate } from 'react-router-dom';  // react-router-dom ^6.8.0
import { SecurityMetrics } from '../utils/security';  // Using local security utils instead

import useAuth from '../hooks/useAuth';
import { COMPANY_ROUTES, CONSUMER_ROUTES } from '../constants/routes.constants';
import { UserRole } from '../types/auth.types';

// Security metrics instance for route access monitoring
const securityMetrics = new SecurityMetrics();

interface PublicRouteProps {
  children: React.ReactNode;
  path: string;
}

/**
 * Higher-order component that implements secure route protection for public routes
 * Handles authentication state validation, role-based redirection, and security monitoring
 * 
 * @param {PublicRouteProps} props - Component props including children and path
 * @returns {JSX.Element} Protected route component or appropriate dashboard redirect
 */
const PublicRoute: React.FC<PublicRouteProps> = ({ children, path }) => {
  const { isAuthenticated, user, status } = useAuth();
  const isLoading = status === 'loading';

  // Monitor and log route access attempts
  useEffect(() => {
    securityMetrics.trackRouteAccess({
      path,
      timestamp: Date.now(),
      isAuthenticated,
      userId: user?.id,
      userRole: user?.role
    });
  }, [path, isAuthenticated, user]);

  // Show accessible loading state
  if (isLoading) {
    return (
      <div 
        role="status" 
        aria-live="polite" 
        aria-busy="true"
        className="loading-container"
      >
        <span className="sr-only">Verifying authentication status...</span>
        {/* Loading spinner or animation would go here */}
      </div>
    );
  }

  // Redirect authenticated users based on role
  if (isAuthenticated && user) {
    // Log redirect attempt
    securityMetrics.trackRouteRedirect({
      from: path,
      userRole: user.role,
      userId: user.id,
      timestamp: Date.now()
    });

    // Determine appropriate dashboard based on user role
    const dashboardPath = user.role === UserRole.COMPANY 
      ? COMPANY_ROUTES.DASHBOARD 
      : CONSUMER_ROUTES.DASHBOARD;

    return <Navigate to={dashboardPath} replace />;
  }

  // Add security headers
  useEffect(() => {
    // Set security headers for public routes
    const headers = {
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };

    Object.entries(headers).forEach(([key, value]) => {
      document.head.appendChild(
        Object.assign(document.createElement('meta'), {
          httpEquiv: key,
          content: value
        })
      );
    });
  }, []);

  // Implement rate limiting
  const [isRateLimited, setIsRateLimited] = React.useState(false);

  useEffect(() => {
    const accessCount = securityMetrics.getRouteAccessCount(path);
    setIsRateLimited(accessCount > 100); // 100 requests per minute limit
  }, [path]);

  if (isRateLimited) {
    return (
      <div role="alert" aria-live="assertive">
        <h2>Too Many Requests</h2>
        <p>Please try again later.</p>
      </div>
    );
  }

  // Return public route content with security wrapper
  return (
    <div 
      className="public-route-container"
      data-testid="public-route"
      aria-label={`Public route: ${path}`}
    >
      {children}
    </div>
  );
};

export default PublicRoute;