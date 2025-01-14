import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // react-router-dom ^6.8.0
import { SecurityMonitor } from '@security/monitor'; // @security/monitor ^1.0.0
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth.types';
import { IAuthUser } from '../interfaces/auth.interface';

/**
 * Security level enum for route protection
 */
enum SecurityLevel {
  STANDARD = 'STANDARD',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Interface for PrivateRoute component props with enhanced security features
 */
interface PrivateRouteProps {
  Component: React.ComponentType;
  allowedRoles: UserRole[];
  requireMFA?: boolean;
  securityLevel?: SecurityLevel;
  auditLogging?: boolean;
}

/**
 * Enhanced higher-order component that protects routes with comprehensive security features
 * Implements HIPAA-compliant access control and security monitoring
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({
  Component,
  allowedRoles,
  requireMFA = false,
  securityLevel = SecurityLevel.STANDARD,
  auditLogging = true
}) => {
  const { isAuthenticated, user, securityMetrics } = useAuth();
  const location = useLocation();
  const securityMonitor = new SecurityMonitor();

  // Enhanced security monitoring effect
  useEffect(() => {
    if (isAuthenticated && user) {
      securityMonitor.trackRouteAccess({
        userId: user.id,
        route: location.pathname,
        timestamp: Date.now(),
        securityLevel,
        role: user.role
      });
    }
  }, [location.pathname, isAuthenticated, user, securityLevel]);

  // Authentication check with security logging
  if (!isAuthenticated) {
    securityMetrics.trackUnauthorizedAccess(location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Type guard for user object
  const validateUser = (user: IAuthUser | null): user is IAuthUser => {
    return user !== null && 
           typeof user.role === 'string' && 
           typeof user.mfaEnabled === 'boolean' &&
           typeof user.mfaVerified === 'boolean';
  };

  if (!validateUser(user)) {
    securityMetrics.trackSecurityAnomaly('INVALID_USER_STATE', location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control with audit logging
  if (!allowedRoles.includes(user.role)) {
    if (auditLogging) {
      securityMetrics.trackUnauthorizedRoleAccess({
        userId: user.id,
        attemptedRole: user.role,
        requiredRoles: allowedRoles,
        route: location.pathname
      });
    }
    return <Navigate to="/unauthorized" replace />;
  }

  // Enhanced MFA validation
  if (requireMFA) {
    if (!user.mfaEnabled) {
      securityMetrics.trackMFARequirement(user.id);
      return <Navigate to="/setup-mfa" state={{ from: location }} replace />;
    }

    if (!user.mfaVerified) {
      securityMetrics.trackMFAChallenge(user.id);
      return <Navigate to="/verify-mfa" state={{ from: location }} replace />;
    }
  }

  // Security level validation
  if (securityLevel === SecurityLevel.CRITICAL && !user.mfaVerified) {
    securityMetrics.trackSecurityLevelViolation({
      userId: user.id,
      requiredLevel: securityLevel,
      route: location.pathname
    });
    return <Navigate to="/verify-mfa" state={{ from: location }} replace />;
  }

  // Log successful access if audit logging is enabled
  if (auditLogging) {
    securityMetrics.trackSuccessfulAccess({
      userId: user.id,
      role: user.role,
      route: location.pathname,
      securityLevel,
      mfaVerified: user.mfaVerified
    });
  }

  // Render protected component if all security checks pass
  return <Component />;
};

export default PrivateRoute;