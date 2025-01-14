import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { AuthError, MFAMethod, SecurityEvent } from '../../types/auth.types';

/**
 * Enhanced secure login page component for MyElixir healthcare data marketplace.
 * Implements HIPAA-compliant authentication with Azure AD B2C and MFA support.
 * Meets WCAG 2.1 Level AA accessibility standards.
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user, securityMetrics } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = user.role === 'COMPANY' ? '/company/dashboard' : '/dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  /**
   * Handles successful login with security validation and audit logging
   * @param credentials - User login credentials
   */
  const handleLoginSuccess = async () => {
    try {
      // Log successful authentication
      securityMetrics.trackLoginSuccess(user?.id);

      // Navigate based on user role
      const redirectPath = user?.role === 'COMPANY' ? '/company/dashboard' : '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error('Login success handler failed:', error);
      securityMetrics.trackError('LOGIN_SUCCESS_HANDLER_FAILED', error);
    }
  };

  /**
   * Processes security-related events during login
   * @param event - Security event details
   */
  const handleSecurityEvent = (event: SecurityEvent) => {
    try {
      securityMetrics.trackSecurityEvent(event);

      // Handle specific security events
      switch (event.type) {
        case 'LOGIN_FAILURE':
          if (event.details.error === AuthError.ACCOUNT_LOCKED) {
            // Handle account lockout
            securityMetrics.trackAccountLockout(event.details.email);
          }
          break;
        case 'MFA_REQUIRED':
          // Track MFA initiation
          securityMetrics.trackMFAInitiated(event.details.email);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Security event handler failed:', error);
      securityMetrics.trackError('SECURITY_EVENT_HANDLER_FAILED', error);
    }
  };

  /**
   * Manages MFA verification process
   * @param context - MFA challenge context
   */
  const handleMFAChallenge = async (method: MFAMethod) => {
    try {
      securityMetrics.trackMFAAttempt(user?.id, method);
      // MFA verification is handled by LoginForm component
      return true;
    } catch (error) {
      console.error('MFA challenge handler failed:', error);
      securityMetrics.trackError('MFA_CHALLENGE_HANDLER_FAILED', error);
      return false;
    }
  };

  return (
    <Container 
      maxWidth="sm" 
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: theme.spacing(4)
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: theme.spacing(3),
          backgroundColor: 'background.paper',
          borderRadius: theme.shape.borderRadius,
          boxShadow: theme.shadows[3]
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{
            color: 'primary.main',
            fontWeight: theme.typography.fontWeightMedium,
            mb: theme.spacing(2)
          }}
        >
          Welcome to MyElixir
        </Typography>

        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mb: theme.spacing(4) }}
        >
          Secure access to your healthcare data marketplace
        </Typography>

        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onSecurityEvent={handleSecurityEvent}
          onMFARequired={handleMFAChallenge}
          mfaOptions={[MFAMethod.SMS, MFAMethod.AUTHENTICATOR_APP, MFAMethod.BIOMETRIC]}
          securityConfig={{
            maxAttempts: 5,
            lockoutDuration: 900000 // 15 minutes
          }}
        />

        {/* Accessibility enhancement for screen readers */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: theme.spacing(2), textAlign: 'center' }}
          role="alert"
          aria-live="polite"
        >
          This login page is protected with enterprise-grade security and supports multi-factor authentication.
        </Typography>
      </Box>
    </Container>
  );
};

export default Login;