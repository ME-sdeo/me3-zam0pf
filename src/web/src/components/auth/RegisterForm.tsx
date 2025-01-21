import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import zxcvbn from 'zxcvbn';

import { IAuthUser } from '../../interfaces/auth.interface';
import { UserRole, MFAMethod } from '../../types/auth.types';
import { AuthService } from '../../services/auth.service';
import Button from '../common/Button';

// Password validation constants
const MIN_PASSWORD_LENGTH = 12;
const MIN_PASSWORD_SCORE = 3;

// Form validation schema
const registerSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .required('Password is required')
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  role: yup
    .string()
    .oneOf([UserRole.CONSUMER, UserRole.COMPANY])
    .required('Please select a role'),
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters'),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters'),
  phoneNumber: yup
    .string()
    .required('Phone number is required for MFA')
    .matches(/^\+[1-9]\d{1,14}$/, 'Please enter a valid international phone number'),
  companyName: yup.string().when('role', {
    is: (val: string) => val === UserRole.COMPANY,
    then: () => yup.string().required('Company name is required'),
  }),
  companyId: yup.string().when('role', {
    is: (val: string) => val === UserRole.COMPANY,
    then: () => yup.string().required('Company ID is required'),
  }),
  acceptTerms: yup
    .boolean()
    .oneOf([true], 'You must accept the terms and conditions'),
  acceptPrivacyPolicy: yup
    .boolean()
    .oneOf([true], 'You must accept the privacy policy'),
  preferredMFAMethod: yup
    .string()
    .oneOf(Object.values(MFAMethod))
    .required('Please select an MFA method'),
});

interface RegisterFormData extends yup.InferType<typeof registerSchema> {}

interface RegisterFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError: setFieldError,
  } = useForm<RegisterFormData>({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur',
  });

  const role = watch('role');
  const password = watch('password');

  // Password strength evaluation
  const evaluatePasswordStrength = useCallback((password: string) => {
    const result = zxcvbn(password);
    setPasswordStrength(result.score);
    return result.score >= MIN_PASSWORD_SCORE;
  }, []);

  // Form submission handler
  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Validate password strength
      if (!evaluatePasswordStrength(data.password)) {
        setFieldError('password', {
          type: 'manual',
          message: 'Please choose a stronger password',
        });
        return;
      }

      // Initialize auth service with MSAL client
      const msalClient = new PublicClientApplication({
        auth: {
          clientId: process.env.REACT_APP_AZURE_CLIENT_ID || '',
          authority: process.env.REACT_APP_AZURE_AUTHORITY || '',
        }
      });
      const authService = new AuthService(msalClient);

      // Register user
      await authService.register({
        email: data.email,
        password: data.password,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        companyName: data.companyName,
        companyId: data.companyId,
        preferredMFAMethod: data.preferredMFAMethod,
        mfaEnabled: true,
      });

      // Setup MFA
      await authService.setupMFA(data.preferredMFAMethod);

      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="register-form" noValidate>
      <div className="form-group">
        <label htmlFor="role">I am a:</label>
        <select
          id="role"
          {...register('role')}
          aria-invalid={!!errors.role}
          aria-describedby="role-error"
        >
          <option value="">Select role</option>
          <option value={UserRole.CONSUMER}>Individual</option>
          <option value={UserRole.COMPANY}>Healthcare Company</option>
        </select>
        {errors.role && (
          <span id="role-error" className="error-message">
            {errors.role.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          autoComplete="email"
        />
        {errors.email && (
          <span id="email-error" className="error-message">
            {errors.email.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="firstName">First Name:</label>
        <input
          type="text"
          id="firstName"
          {...register('firstName')}
          aria-invalid={!!errors.firstName}
          aria-describedby="firstName-error"
          autoComplete="given-name"
        />
        {errors.firstName && (
          <span id="firstName-error" className="error-message">
            {errors.firstName.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="lastName">Last Name:</label>
        <input
          type="text"
          id="lastName"
          {...register('lastName')}
          aria-invalid={!!errors.lastName}
          aria-describedby="lastName-error"
          autoComplete="family-name"
        />
        {errors.lastName && (
          <span id="lastName-error" className="error-message">
            {errors.lastName.message}
          </span>
        )}
      </div>

      {role === UserRole.COMPANY && (
        <>
          <div className="form-group">
            <label htmlFor="companyName">Company Name:</label>
            <input
              type="text"
              id="companyName"
              {...register('companyName')}
              aria-invalid={!!errors.companyName}
              aria-describedby="companyName-error"
              autoComplete="organization"
            />
            {errors.companyName && (
              <span id="companyName-error" className="error-message">
                {errors.companyName.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="companyId">Company ID:</label>
            <input
              type="text"
              id="companyId"
              {...register('companyId')}
              aria-invalid={!!errors.companyId}
              aria-describedby="companyId-error"
            />
            {errors.companyId && (
              <span id="companyId-error" className="error-message">
                {errors.companyId.message}
              </span>
            )}
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          {...register('password')}
          aria-invalid={!!errors.password}
          aria-describedby="password-error password-strength"
          autoComplete="new-password"
        />
        {password && (
          <div id="password-strength" className="password-strength">
            Password strength: {['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][passwordStrength]}
          </div>
        )}
        {errors.password && (
          <span id="password-error" className="error-message">
            {errors.password.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password:</label>
        <input
          type="password"
          id="confirmPassword"
          {...register('confirmPassword')}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirmPassword-error"
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <span id="confirmPassword-error" className="error-message">
            {errors.confirmPassword.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="phoneNumber">Phone Number (for MFA):</label>
        <input
          type="tel"
          id="phoneNumber"
          {...register('phoneNumber')}
          aria-invalid={!!errors.phoneNumber}
          aria-describedby="phoneNumber-error"
          autoComplete="tel"
          placeholder="+1234567890"
        />
        {errors.phoneNumber && (
          <span id="phoneNumber-error" className="error-message">
            {errors.phoneNumber.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="preferredMFAMethod">Preferred MFA Method:</label>
        <select
          id="preferredMFAMethod"
          {...register('preferredMFAMethod')}
          aria-invalid={!!errors.preferredMFAMethod}
          aria-describedby="preferredMFAMethod-error"
        >
          <option value="">Select MFA method</option>
          <option value={MFAMethod.SMS}>SMS</option>
          <option value={MFAMethod.AUTHENTICATOR_APP}>Authenticator App</option>
          <option value={MFAMethod.BIOMETRIC}>Biometric (if supported)</option>
        </select>
        {errors.preferredMFAMethod && (
          <span id="preferredMFAMethod-error" className="error-message">
            {errors.preferredMFAMethod.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            {...register('acceptTerms')}
            aria-invalid={!!errors.acceptTerms}
            aria-describedby="acceptTerms-error"
          />
          I accept the terms and conditions
        </label>
        {errors.acceptTerms && (
          <span id="acceptTerms-error" className="error-message">
            {errors.acceptTerms.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            {...register('acceptPrivacyPolicy')}
            aria-invalid={!!errors.acceptPrivacyPolicy}
            aria-describedby="acceptPrivacyPolicy-error"
          />
          I accept the privacy policy and consent to data processing
        </label>
        {errors.acceptPrivacyPolicy && (
          <span id="acceptPrivacyPolicy-error" className="error-message">
            {errors.acceptPrivacyPolicy.message}
          </span>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        disabled={loading}
        fullWidth
        aria-label="Complete registration"
      >
        Register
      </Button>
    </form>
  );
};

export default RegisterForm;