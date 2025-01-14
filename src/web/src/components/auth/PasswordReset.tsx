import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { AuthService } from '../../services/auth.service';
import Button from '../common/Button';
import Alert from '../common/Alert';

// Password validation schema with HIPAA compliance
const passwordSchema = yup.object().shape({
  email: yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  resetToken: yup.string()
    .when('step', {
      is: 'reset',
      then: yup.string().required('Reset token is required')
    }),
  newPassword: yup.string()
    .when('step', {
      is: 'reset',
      then: yup.string()
        .required('New password is required')
        .min(12, 'Password must be at least 12 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/[0-9]/, 'Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
        .notOneOf(['Password123!', 'Admin123!'], 'Please use a stronger password')
    }),
  confirmPassword: yup.string()
    .when('step', {
      is: 'reset',
      then: yup.string()
        .required('Please confirm your password')
        .oneOf([yup.ref('newPassword')], 'Passwords must match')
    })
});

interface PasswordResetFormData {
  email: string;
  resetToken?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const PasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<Date | null>(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<PasswordResetFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      resetToken: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  // Rate limiting check
  useEffect(() => {
    if (lastAttemptTime && attemptCount >= 3) {
      const timeSinceLastAttempt = new Date().getTime() - lastAttemptTime.getTime();
      if (timeSinceLastAttempt < 300000) { // 5 minutes
        setError('Too many attempts. Please try again in 5 minutes.');
      }
    }
  }, [attemptCount, lastAttemptTime]);

  const handlePasswordReset = async (data: PasswordResetFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Rate limiting check
      if (attemptCount >= 3 && lastAttemptTime && 
          (new Date().getTime() - lastAttemptTime.getTime()) < 300000) {
        throw new Error('Too many attempts. Please try again in 5 minutes.');
      }

      const authService = new AuthService();

      if (step === 'request') {
        await authService.validateResetToken(data.email);
        setStep('reset');
        setSuccess(true);
      } else {
        await authService.resetPassword({
          email: data.email,
          resetToken: data.resetToken!,
          newPassword: data.newPassword!
        });

        // Log security event
        await authService.logSecurityEvent({
          eventType: 'PASSWORD_RESET_SUCCESS',
          userIdentifier: data.email,
          timestamp: new Date(),
          eventDetails: {
            method: 'reset',
            success: true
          }
        });

        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err) {
      setAttemptCount(prev => prev + 1);
      setLastAttemptTime(new Date());
      setError(err instanceof Error ? err.message : 'An error occurred');

      // Log security event
      const authService = new AuthService();
      await authService.logSecurityEvent({
        eventType: 'PASSWORD_RESET_FAILED',
        userIdentifier: data.email,
        timestamp: new Date(),
        eventDetails: {
          method: 'reset',
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-reset" role="main" aria-labelledby="reset-title">
      <h1 id="reset-title" className="password-reset__title">
        {step === 'request' ? 'Reset Your Password' : 'Enter New Password'}
      </h1>

      {error && (
        <Alert
          severity="error"
          message={error}
          onClose={() => setError(null)}
          aria-live="polite"
        />
      )}

      {success && step === 'request' && (
        <Alert
          severity="success"
          message="Reset instructions have been sent to your email"
          aria-live="polite"
        />
      )}

      {success && step === 'reset' && (
        <Alert
          severity="success"
          message="Password has been successfully reset. Redirecting to login..."
          aria-live="polite"
        />
      )}

      <form 
        onSubmit={handleSubmit(handlePasswordReset)}
        className="password-reset__form"
        noValidate
      >
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            className={`form-input ${errors.email ? 'form-input--error' : ''}`}
            {...register('email')}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            disabled={loading}
          />
          {errors.email && (
            <span id="email-error" className="form-error" role="alert">
              {errors.email.message}
            </span>
          )}
        </div>

        {step === 'reset' && (
          <>
            <div className="form-group">
              <label htmlFor="resetToken" className="form-label">
                Reset Token
              </label>
              <input
                id="resetToken"
                type="text"
                className={`form-input ${errors.resetToken ? 'form-input--error' : ''}`}
                {...register('resetToken')}
                aria-invalid={errors.resetToken ? 'true' : 'false'}
                aria-describedby={errors.resetToken ? 'token-error' : undefined}
                disabled={loading}
              />
              {errors.resetToken && (
                <span id="token-error" className="form-error" role="alert">
                  {errors.resetToken.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                className={`form-input ${errors.newPassword ? 'form-input--error' : ''}`}
                {...register('newPassword')}
                aria-invalid={errors.newPassword ? 'true' : 'false'}
                aria-describedby={errors.newPassword ? 'password-error' : undefined}
                disabled={loading}
              />
              {errors.newPassword && (
                <span id="password-error" className="form-error" role="alert">
                  {errors.newPassword.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`form-input ${errors.confirmPassword ? 'form-input--error' : ''}`}
                {...register('confirmPassword')}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                disabled={loading}
              />
              {errors.confirmPassword && (
                <span id="confirm-error" className="form-error" role="alert">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>
          </>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          loading={loading}
          aria-label={step === 'request' ? 'Request password reset' : 'Reset password'}
          fullWidth
        >
          {step === 'request' ? 'Request Reset' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};

export default PasswordReset;