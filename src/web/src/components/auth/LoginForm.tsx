import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { AuthError, MFAMethod, AuthStatus } from '../../types/auth.types';
import { ILoginCredentials } from '../../interfaces/auth.interface';

// Form validation schema with HIPAA-compliant password requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .required('Password is required')
    .min(12, 'Password must be at least 12 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must include uppercase, lowercase, number and special character'
    ),
  rememberMe: yup.boolean()
});

interface LoginFormProps {
  onLoginSuccess: () => void;
  onSecurityEvent: (event: SecurityEvent) => void;
  mfaOptions?: MFAMethod[];
  securityConfig?: {
    maxAttempts: number;
    lockoutDuration: number;
  };
}

interface SecurityEvent {
  type: 'LOGIN_ATTEMPT' | 'MFA_REQUIRED' | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE';
  details: Record<string, unknown>;
  timestamp: number;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLoginSuccess,
  onSecurityEvent,
  mfaOptions = [MFAMethod.SMS, MFAMethod.AUTHENTICATOR_APP],
  securityConfig = { maxAttempts: 5, lockoutDuration: 900000 } // 15 minutes
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);

  const { login, verifyMFA } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ILoginCredentials>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });

  // Initialize device fingerprinting
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        if (process.env.REACT_APP_FINGERPRINT_API_KEY) {
          const fp = await FingerprintJS.load({
            apiKey: process.env.REACT_APP_FINGERPRINT_API_KEY
          });
          const result = await fp.get();
          setDeviceFingerprint(result.visitorId);
        }
      } catch (error) {
        console.error('Fingerprint initialization failed:', error);
      }
    };
    initFingerprint();
  }, []);

  // Check for account lockout
  const isLocked = () => {
    return lockoutEnd ? Date.now() < lockoutEnd : false;
  };

  const handleLogin = async (credentials: ILoginCredentials) => {
    if (isLocked()) {
      setError(AuthError.ACCOUNT_LOCKED);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      onSecurityEvent({
        type: 'LOGIN_ATTEMPT',
        details: { email: credentials.email, deviceFingerprint },
        timestamp: Date.now()
      });

      const response = await login(credentials);

      if (response && response.requiresMFA) {
        setMfaRequired(true);
        onSecurityEvent({
          type: 'MFA_REQUIRED',
          details: { email: credentials.email },
          timestamp: Date.now()
        });
      } else {
        onLoginSuccess();
        onSecurityEvent({
          type: 'LOGIN_SUCCESS',
          details: { email: credentials.email },
          timestamp: Date.now()
        });
        reset();
      }
    } catch (err) {
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      if (newAttemptCount >= securityConfig.maxAttempts) {
        setLockoutEnd(Date.now() + securityConfig.lockoutDuration);
        setError(AuthError.ACCOUNT_LOCKED);
      } else {
        setError(AuthError.INVALID_CREDENTIALS);
      }

      onSecurityEvent({
        type: 'LOGIN_FAILURE',
        details: { 
          email: credentials.email, 
          error: err instanceof Error ? err.message : 'Unknown error',
          attemptCount: newAttemptCount
        },
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (code: string) => {
    try {
      setIsLoading(true);
      await verifyMFA(code);
      onLoginSuccess();
      reset();
    } catch (error) {
      setError(AuthError.MFA_FAILED);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(handleLogin)}
      className="login-form"
      aria-label="Login form"
      noValidate
    >
      {error && (
        <div 
          className="login-form__error" 
          role="alert"
          aria-live="polite"
        >
          {error === AuthError.ACCOUNT_LOCKED ? (
            `Account temporarily locked. Please try again in ${
              Math.ceil((lockoutEnd! - Date.now()) / 60000)
            } minutes.`
          ) : (
            'Invalid email or password. Please try again.'
          )}
        </div>
      )}

      <div className="login-form__field">
        <label htmlFor="email" className="login-form__label">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="login-form__input"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          disabled={isLoading || isLocked()}
          autoComplete="username"
        />
        {errors.email && (
          <span id="email-error" className="login-form__error-message">
            {errors.email.message}
          </span>
        )}
      </div>

      <div className="login-form__field">
        <label htmlFor="password" className="login-form__label">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className="login-form__input"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          disabled={isLoading || isLocked()}
          autoComplete="current-password"
        />
        {errors.password && (
          <span id="password-error" className="login-form__error-message">
            {errors.password.message}
          </span>
        )}
      </div>

      <div className="login-form__field">
        <label className="login-form__checkbox">
          <input
            type="checkbox"
            {...register('rememberMe')}
            disabled={isLoading || isLocked()}
          />
          <span>Remember me on this device</span>
        </label>
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={isLoading}
        disabled={isLoading || isLocked()}
        fullWidth
        ariaLabel="Sign in to your account"
      >
        Sign In
      </Button>

      {mfaRequired && (
        <div className="login-form__mfa" role="dialog" aria-label="Two-factor authentication">
          {mfaOptions.map((method) => (
            <Button
              key={method}
              variant="secondary"
              onClick={() => handleMFASubmit('')}
              disabled={isLoading}
              ariaLabel={`Verify with ${method.toLowerCase()}`}
            >
              {`Verify with ${method.replace('_', ' ')}`}
            </Button>
          ))}
        </div>
      )}
    </form>
  );
};

export default LoginForm;