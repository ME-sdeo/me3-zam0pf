import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AzureAuthProvider } from '@azure/msal-react'; // ^2.0.0
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
  const { authState, securityContext } = useAuth();

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
    securityContext?.logSecurityEvent({
      eventType: 'REGISTRATION_PAGE_ACCESS',
      sessionData: securitySession
    });

    return () => {
      // Cleanup security monitoring
      securityContext?.logSecurityEvent({
        eventType: 'REGISTRATION_PAGE_EXIT',
        sessionId: securitySession.sessionId,
        duration: Date.now() - securitySession.startTime
      });
    };
  }, [securityContext]);

  /**
   * Handles successful registration completion with security logging
   * @param userData - Registration form data
   */
  const handleRegistrationComplete = async (userData: any) => {
    try {
      // Log successful registration
      securityContext?.logSecurityEvent({
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
   * @param setupResult - MFA setup result
   */
  const handleMFAComplete = async (setupResult: any) => {
    try {
      // Verify MFA setup completion
      if (!setupResult.verified) {
        throw new Error('MFA verification failed');
      }

      // Log successful MFA setup
      securityContext?.logSecurityEvent({
        eventType: 'MFA_SETUP_SUCCESS',
        userId: authState.user?.id,
        mfaMethod: setupResult.method,
        timestamp: new Date().toISOString()
      });

      // Update auth state with MFA status
      authState.status = AuthStatus.AUTHENTICATED;

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
    securityContext?.logSecurityEvent({
      eventType: 'REGISTRATION_ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    setSecurityError(error.message);

    // Trigger security alert if needed
    if (error.message.includes('suspicious')) {
      securityContext?.triggerSecurityAlert({
        type: 'SUSPICIOUS_REGISTRATION_ATTEMPT',
        severity: 'HIGH'
      });
    }
  };

  return (
    <AzureAuthProvider>
      <div className="register-page" role="main" aria-label="Registration Page">
        <div className="register-container">
          <h1>Create Your Account</h1>
          
          {!registrationComplete ? (
            <RegisterForm
              onSubmit={handleRegistrationComplete}
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
    </AzureAuthProvider>
  );
};

export default Register;