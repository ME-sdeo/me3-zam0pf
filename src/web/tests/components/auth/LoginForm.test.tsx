import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from '../../src/components/auth/LoginForm';
import { useAuth } from '../../src/hooks/useAuth';
import { 
  AuthError, 
  MFAMethod, 
  AuthStatus 
} from '../../src/types/auth.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

// Mock security logger
jest.mock('@myelixir/security-logger', () => ({
  SecurityLogger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }))
}));

// Mock FingerprintJS
jest.mock('@fingerprintjs/fingerprintjs-pro', () => ({
  load: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue({ visitorId: 'mock-fingerprint' })
  })
}));

// Test constants
const mockCredentials = {
  email: 'test@example.com',
  password: 'SecureP@ssw0rd123',
  rememberMe: false
};

const mockMFAOptions = [MFAMethod.SMS, MFAMethod.AUTHENTICATOR_APP];

const mockSecurityConfig = {
  maxAttempts: 5,
  lockoutDuration: 900000 // 15 minutes
};

// Helper function to setup component render with all required props
const renderLoginForm = (props = {}) => {
  const defaultProps = {
    onLoginSuccess: jest.fn(),
    onSecurityEvent: jest.fn(),
    mfaOptions: mockMFAOptions,
    securityConfig: mockSecurityConfig
  };

  return render(<LoginForm {...defaultProps} {...props} />);
};

describe('LoginForm Security and Accessibility Tests', () => {
  let mockLogin: jest.Mock;
  let mockVerifyMFA: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin = jest.fn();
    mockVerifyMFA = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      verifyMFA: mockVerifyMFA
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderLoginForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Verify tab order
      expect(document.body).toHaveFocus();
      userEvent.tab();
      expect(emailInput).toHaveFocus();
      userEvent.tab();
      expect(passwordInput).toHaveFocus();
      userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      renderLoginForm();
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.click(submitButton);
      
      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const onLoginSuccess = jest.fn();
      const onSecurityEvent = jest.fn();
      mockLogin.mockResolvedValueOnce({ status: AuthStatus.AUTHENTICATED });

      renderLoginForm({ onLoginSuccess, onSecurityEvent });

      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          ...mockCredentials,
          deviceFingerprint: 'mock-fingerprint'
        });
        expect(onLoginSuccess).toHaveBeenCalled();
        expect(onSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
          type: 'LOGIN_SUCCESS'
        }));
      });
    });

    it('should enforce password complexity requirements', async () => {
      renderLoginForm();
      
      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), 'weak');
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
      });
    });

    it('should implement rate limiting', async () => {
      const onSecurityEvent = jest.fn();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      renderLoginForm({ onSecurityEvent });

      // Attempt login multiple times
      for (let i = 0; i < mockSecurityConfig.maxAttempts + 1; i++) {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
          expect(onSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'LOGIN_FAILURE'
          }));
        });
      }

      // Verify account lockout
      expect(screen.getByText(/account temporarily locked/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });
  });

  describe('MFA Implementation', () => {
    it('should handle MFA requirement', async () => {
      const onSecurityEvent = jest.fn();
      mockLogin.mockResolvedValueOnce({ status: AuthStatus.MFA_REQUIRED });

      renderLoginForm({ onSecurityEvent });

      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /two-factor authentication/i })).toBeInTheDocument();
        expect(onSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
          type: 'MFA_REQUIRED'
        }));
      });
    });

    it('should support multiple MFA methods', async () => {
      mockLogin.mockResolvedValueOnce({ status: AuthStatus.MFA_REQUIRED });

      renderLoginForm();

      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        mockMFAOptions.forEach(method => {
          expect(screen.getByRole('button', { name: new RegExp(method, 'i') })).toBeInTheDocument();
        });
      });
    });

    it('should handle MFA verification', async () => {
      const onLoginSuccess = jest.fn();
      mockLogin.mockResolvedValueOnce({ status: AuthStatus.MFA_REQUIRED });
      mockVerifyMFA.mockResolvedValueOnce({ status: AuthStatus.AUTHENTICATED });

      renderLoginForm({ onLoginSuccess });

      // Trigger MFA flow
      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify MFA
      await waitFor(() => {
        const smsButton = screen.getByRole('button', { name: /verify with sms/i });
        fireEvent.click(smsButton);
      });

      await waitFor(() => {
        expect(mockVerifyMFA).toHaveBeenCalled();
        expect(onLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display HIPAA-compliant error messages', async () => {
      mockLogin.mockRejectedValueOnce(new Error(AuthError.INVALID_CREDENTIALS));

      renderLoginForm();

      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
        expect(screen.queryByText(/specific error details/i)).not.toBeInTheDocument();
      });
    });

    it('should clear sensitive form data after errors', async () => {
      mockLogin.mockRejectedValueOnce(new Error(AuthError.INVALID_CREDENTIALS));

      renderLoginForm();

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, mockCredentials.password);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(passwordInput).toHaveValue('');
      });
    });
  });
});