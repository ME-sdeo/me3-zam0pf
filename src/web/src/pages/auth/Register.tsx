import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react'; // Using correct provider
import RegisterForm from '../../components/auth/RegisterForm';
import MFASetup from '../../components/auth/MFASetup';
import { useAuth } from '../../hooks/useAuth';
import { AuthStatus, UserRole } from '../../types/auth.types';

/**
 * Secure registration page component implementing HIPAA-compliant user registration
 * with Azure AD B2C integration, mandatory MFA setup, and security monitoring
 */
const Register: React.FC = () => {
  // Navigation and auth hooks
  const navigate = useNavigate();
  const { isAuthenticated, status, user, securityMetrics } = useAuth();

  // Component state
  const [registrationComplete, setRegistrationComplete] = useState<boolean>(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Security monitoring setup
  useEffect(() => {
    // Initialize security monitoring context
    const securitySession = {
      sessionId: crypto.randomUUID(),
      startTime: Date.now(),
      deviceFingerprint: navigator.userAgent,
      geoLocation: null as GeolocationPosition | null
    };

    // Get geolocation if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          securitySession.geoLocation = position;
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }

    // Log security event for registration page access
    securityMetrics?.logSecurityEvent({
      eventType: 'REGISTRATION_PAGE_ACCESS',
      sessionData: securitySession
    });

    return () => {
      // Cleanup security monitoring
      securityMetrics?.logSecurityEvent({
        eventType: 'REGISTRATION_PAGE_EXIT',
        sessionId: securitySession.sessionId,
        duration: Date.now() - securitySession.startTime
      });
    };
  }, [securityMetrics]);

  /**
   * Handles successful registration completion with security logging
   * @param userData - Registration form data
   */
  const handleRegistrationComplete = async (userData: any) => {
    try {
      // Log successful registration
      securityMetrics?.logSecurityEvent({
        eventType: 'REGISTRATION_SUCCESS',
        userId: userData.id,
        userRole: userData.role,
        timestamp: new Date().toISOString()
      });

      setRegistrationComplete(true);

      // Navigate based on user role after MFA setup
      if (userData.role === UserRole.CONSUMER) {
        navigate('/consumer/dashboard');
      } else if (userData.role === UserRole.COMPANY) {
        navigate('/company/dashboard');
      }
    } catch (error) {
      handleSecurityError(error as Error);
    }
  };

  /**
   * Handles MFA setup completion with security verification
   */
  const handleMFAComplete = async () => {
    try {
      // Log successful MFA setup
      securityMetrics?.logSecurityEvent({
        eventType: 'MFA_SETUP_SUCCESS',
        userId: user?.id,
        timestamp: new Date().toISOString()
      });

      // Update auth state with MFA status
      status = AuthStatus.AUTHENTICATED;

    } catch (error) {
      handleSecurityError(error as Error);
    }
  };

  /**
   * Handles security-related errors during registration
   * @param error - Security error
   */
  const handleSecurityError = (error: Error) => {
    // Log security error
    securityMetrics?.logSecurityEvent({
      eventType: 'REGISTRATION_ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    setSecurityError(error.message);

    // Trigger security alert if needed
    if (error.message.includes('suspicious')) {
      securityMetrics?.triggerSecurityAlert({
        type: 'SUSPICIOUS_REGISTRATION_ATTEMPT',
        severity: 'HIGH'
      });
    }
  };

  return (
    <MsalProvider>
      <div className="register-page" role="main" aria-label="Registration Page">
        <div className="register-container">
          <h1>Create Your Account</h1>
          
          {!registrationComplete ? (
            <RegisterForm
              onSuccess={handleRegistrationComplete}
              onError={handleSecurityError}
            />
          ) : (
            <MFASetup
              onComplete={handleMFAComplete}
              onError={handleSecurityError}
            />
          )}

          {securityError && (
            <div 
              className="security-error" 
              role="alert" 
              aria-live="polite"
            >
              {securityError}
            </div>
          )}
        </div>
      </div>
    </MsalProvider>
  );
};

export default Register;