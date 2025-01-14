import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { SecurityUtils } from '@azure/security-utils'; // ^1.0.0
import { PasswordReset } from '../../components/auth/PasswordReset';
import { validatePassword } from '../../utils/validation.util';
import { AuthService } from '../../services/auth.service';
import Alert from '../../components/common/Alert';

/**
 * HIPAA-compliant password reset page component with Azure AD B2C integration
 * Implements comprehensive security measures including rate limiting and audit logging
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const authService = new AuthService();
  const securityUtils = new SecurityUtils();

  // Initialize security checks and token validation
  useEffect(() => {
    const validateResetAttempt = async () => {
      try {
        const resetToken = searchParams.get('token');
        if (!resetToken) {
          throw new Error('Invalid reset token');
        }

        // Get device fingerprint for security validation
        const deviceFingerprint = await securityUtils.getDeviceFingerprint();

        // Validate token and security parameters
        const isValid = await validateResetAttempt(resetToken, deviceFingerprint);
        if (!isValid) {
          throw new Error('Invalid or expired reset request');
        }

        // Check if MFA is required based on risk assessment
        const mfaRequired = await authService.validateResetToken(resetToken);
        setRequiresMfa(mfaRequired);

        setLoading(false);
      } catch (error) {
        await handleResetError(error as Error);
      }
    };

    validateResetAttempt();
  }, [searchParams]);

  /**
   * Validates reset attempt against security rules
   */
  const validateResetAttempt = async (
    token: string,
    deviceFingerprint: string
  ): Promise<boolean> => {
    try {
      // Validate token format and expiration
      const isTokenValid = await authService.validateResetToken(token);
      if (!isTokenValid) return false;

      // Check rate limiting status
      if (attempts >= 3) {
        const lockoutDuration = 300000; // 5 minutes
        setIsLocked(true);
        setTimeout(() => setIsLocked(false), lockoutDuration);
        return false;
      }

      // Validate device fingerprint
      const isDeviceValid = await securityUtils.validateDeviceFingerprint(
        deviceFingerprint
      );
      if (!isDeviceValid) return false;

      // Log validation attempt
      await authService.logSecurityEvent({
        eventType: 'PASSWORD_RESET_VALIDATION',
        status: 'success',
        deviceFingerprint
      });

      return true;
    } catch (error) {
      await handleResetError(error as Error);
      return false;
    }
  };

  /**
   * Handles successful password reset with security logging
   */
  const handleResetSuccess = async () => {
    try {
      setSuccess(true);

      // Log successful reset
      await authService.logSecurityEvent({
        eventType: 'PASSWORD_RESET_SUCCESS',
        timestamp: new Date()
      });

      // Clear sensitive form data
      const form = document.querySelector('form');
      if (form) {
        form.reset();
      }

      // Announce success for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.textContent = 'Password successfully reset';
      document.body.appendChild(announcement);

      // Navigate to login after security delay
      setTimeout(() => {
        navigate('/login');
        document.body.removeChild(announcement);
      }, 3000);
    } catch (error) {
      await handleResetError(error as Error);
    }
  };

  /**
   * Handles password reset errors with security measures
   */
  const handleResetError = async (error: Error) => {
    // Log error details securely
    await authService.logSecurityEvent({
      eventType: 'PASSWORD_RESET_ERROR',
      error: error.message,
      timestamp: new Date()
    });

    // Update attempt counter and check rate limiting
    setAttempts(prev => prev + 1);
    if (attempts >= 2) {
      setIsLocked(true);
      await authService.logSecurityEvent({
        eventType: 'PASSWORD_RESET_LOCKOUT',
        timestamp: new Date()
      });
    }

    // Display secure error message
    setError('Unable to process reset request. Please try again later.');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="reset-password__loading" role="alert" aria-busy="true">
        <CircularProgress />
        <span className="visually-hidden">Validating reset request...</span>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="reset-password__locked" role="alert">
        <Alert
          severity="error"
          message="Too many attempts. Please try again in 5 minutes."
        />
      </div>
    );
  }

  return (
    <div className="reset-password" role="main" aria-labelledby="reset-title">
      <h1 id="reset-title" className="reset-password__title">
        Reset Your Password
      </h1>

      {error && (
        <Alert
          severity="error"
          message={error}
          onClose={() => setError(null)}
          className="reset-password__alert"
        />
      )}

      {success && (
        <Alert
          severity="success"
          message="Password successfully reset. Redirecting to login..."
          className="reset-password__alert"
        />
      )}

      {requiresMfa && (
        <Alert
          severity="info"
          message="Additional verification required for security"
          className="reset-password__alert"
        />
      )}

      <PasswordReset
        onSuccess={handleResetSuccess}
        onError={handleResetError}
        requiresMfa={requiresMfa}
        isLocked={isLocked}
        className="reset-password__form"
      />
    </div>
  );
};

export default ResetPassword;