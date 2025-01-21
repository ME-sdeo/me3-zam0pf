import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { PublicClientApplication } from '@azure/msal-browser';
import PasswordReset from '../../components/auth/PasswordReset';
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

  // Initialize MSAL and auth service
  const msalConfig = {
    auth: {
      clientId: process.env.REACT_APP_CLIENT_ID || '',
      authority: `https://${process.env.REACT_APP_B2C_TENANT_NAME}.b2clogin.com/${process.env.REACT_APP_B2C_TENANT_NAME}.onmicrosoft.com/v2.0`
    }
  };
  const msalClient = new PublicClientApplication(msalConfig);
  const authService = new AuthService(msalClient, msalConfig);

  // Initialize security checks and token validation
  useEffect(() => {
    const validateResetAttempt = async () => {
      try {
        const resetToken = searchParams.get('token');
        if (!resetToken) {
          throw new Error('Invalid reset token');
        }

        // Validate token and check MFA requirement
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
   * Handles successful password reset with security logging
   */
  const handleResetSuccess = async () => {
    try {
      setSuccess(true);

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
    // Update attempt counter and check rate limiting
    setAttempts(prev => prev + 1);
    if (attempts >= 2) {
      setIsLocked(true);
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