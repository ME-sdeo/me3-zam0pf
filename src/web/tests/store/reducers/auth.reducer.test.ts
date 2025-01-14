import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // @jest/globals ^29.0.0
import { ApplicationInsights } from '@microsoft/applicationinsights-web'; // @microsoft/applicationinsights-web ^2.8.0

import authReducer, { 
  clearError, 
  clearAuthState,
  updateSecurityContext 
} from '../../../../src/store/reducers/auth.reducer';
import { AuthStatus, MFAMethod, AuthError } from '../../../../src/types/auth.types';
import { AUTH_ERRORS } from '../../../../src/constants/auth.constants';
import { IAuthState } from '../../../../src/interfaces/auth.interface';

// Mock Application Insights
jest.mock('@microsoft/applicationinsights-web');
const mockTrackEvent = jest.fn();
const mockTrackException = jest.fn();

(ApplicationInsights as jest.Mock).mockImplementation(() => ({
  loadAppInsights: jest.fn(),
  trackEvent: mockTrackEvent,
  trackException: mockTrackException,
}));

describe('authReducer', () => {
  let initialState: IAuthState;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test state
    initialState = {
      status: AuthStatus.UNAUTHENTICATED,
      user: null,
      error: null,
      securityContext: {
        lastActivity: Date.now(),
        deviceFingerprint: null,
        sessionId: null,
        auditLog: [],
      },
      mfaState: {
        verificationId: null,
        method: null,
        attempts: 0,
      },
      tokens: null,
      sessionExpiry: 0,
      isAuthenticated: false,
    };
  });

  describe('Initial State', () => {
    test('should return initial state', () => {
      const state = authReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });
  });

  describe('Login Flow', () => {
    test('should handle login pending state', () => {
      const state = authReducer(initialState, { 
        type: 'auth/loginUser/pending' 
      });
      
      expect(state.status).toBe(AuthStatus.UNAUTHENTICATED);
      expect(state.error).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith({ 
        name: 'Auth.LoginAttempt' 
      });
    });

    test('should handle successful login with MFA required', () => {
      const mockPayload = {
        requiresMfa: true,
        verificationId: 'test-verification-id',
        mfaMethod: MFAMethod.SMS,
        user: { id: '1', email: 'test@example.com' },
        tokens: { accessToken: 'test-token' },
        expiresIn: 3600000,
      };

      const state = authReducer(initialState, {
        type: 'auth/loginUser/fulfilled',
        payload: mockPayload,
      });

      expect(state.status).toBe(AuthStatus.MFA_REQUIRED);
      expect(state.mfaState).toEqual({
        verificationId: mockPayload.verificationId,
        method: mockPayload.mfaMethod,
        attempts: 0,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.LoginSuccess',
        properties: { requiresMfa: true },
      });
    });

    test('should handle failed login with security logging', () => {
      const errorMessage = AUTH_ERRORS.INVALID_CREDENTIALS;
      const state = authReducer(initialState, {
        type: 'auth/loginUser/rejected',
        payload: { message: errorMessage },
      });

      expect(state.status).toBe(AuthStatus.UNAUTHENTICATED);
      expect(state.error).toBe(errorMessage);
      expect(mockTrackException).toHaveBeenCalledWith({
        error: new Error(errorMessage),
        severityLevel: 2,
      });
    });
  });

  describe('MFA Verification', () => {
    const mfaInitialState = {
      ...initialState,
      status: AuthStatus.MFA_REQUIRED,
      mfaState: {
        verificationId: 'test-id',
        method: MFAMethod.SMS,
        attempts: 0,
      },
    };

    test('should handle MFA verification pending', () => {
      const state = authReducer(mfaInitialState, {
        type: 'auth/verifyMfa/pending',
      });

      expect(state.status).toBe(AuthStatus.MFA_IN_PROGRESS);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.MfaVerificationAttempt',
      });
    });

    test('should handle successful MFA verification', () => {
      const state = authReducer(mfaInitialState, {
        type: 'auth/verifyMfa/fulfilled',
      });

      expect(state.status).toBe(AuthStatus.AUTHENTICATED);
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaState).toEqual(initialState.mfaState);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.MfaVerificationSuccess',
      });
    });

    test('should handle failed MFA verification with attempt tracking', () => {
      const state = authReducer(mfaInitialState, {
        type: 'auth/verifyMfa/rejected',
        payload: { message: AUTH_ERRORS.MFA_REQUIRED },
      });

      expect(state.mfaState.attempts).toBe(1);
      expect(mockTrackException).toHaveBeenCalledWith({
        error: new Error(AUTH_ERRORS.MFA_REQUIRED),
        severityLevel: 2,
        properties: { attempts: 1 },
      });
    });
  });

  describe('Token Management', () => {
    test('should handle successful token refresh', () => {
      const mockPayload = {
        tokens: { accessToken: 'new-token' },
        expiresIn: 3600000,
      };

      const state = authReducer(initialState, {
        type: 'auth/refreshToken/fulfilled',
        payload: mockPayload,
      });

      expect(state.tokens).toEqual(mockPayload.tokens);
      expect(state.sessionExpiry).toBeGreaterThan(Date.now());
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.TokenRefreshSuccess',
      });
    });

    test('should handle failed token refresh with security logging', () => {
      const state = authReducer(initialState, {
        type: 'auth/refreshToken/rejected',
      });

      expect(state.status).toBe(AuthStatus.UNAUTHENTICATED);
      expect(state.error).toBe(AUTH_ERRORS.TOKEN_EXPIRED);
      expect(state.isAuthenticated).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.TokenRefreshFailed',
      });
    });
  });

  describe('Security Context Management', () => {
    test('should update security context with activity tracking', () => {
      const mockContext = {
        deviceFingerprint: 'test-device',
        sessionId: 'test-session',
      };

      const state = authReducer(initialState, updateSecurityContext(mockContext));

      expect(state.securityContext).toEqual({
        ...initialState.securityContext,
        ...mockContext,
        lastActivity: expect.any(Number),
      });
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.SecurityContextUpdate',
        properties: mockContext,
      });
    });

    test('should clear security context on logout', () => {
      const state = authReducer(initialState, {
        type: 'auth/logout/fulfilled',
      });

      expect(state).toEqual(initialState);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.LogoutSuccess',
      });
    });
  });

  describe('Error Handling', () => {
    test('should clear errors and update activity timestamp', () => {
      const stateWithError = {
        ...initialState,
        error: 'Test error',
      };

      const state = authReducer(stateWithError, clearError());

      expect(state.error).toBeNull();
      expect(state.securityContext.lastActivity).toBeGreaterThan(0);
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.ClearError',
      });
    });

    test('should clear auth state with security logging', () => {
      const authenticatedState = {
        ...initialState,
        status: AuthStatus.AUTHENTICATED,
        isAuthenticated: true,
        user: { id: '1' },
        tokens: { accessToken: 'test' },
      };

      const state = authReducer(authenticatedState, clearAuthState());

      expect(state.status).toBe(AuthStatus.UNAUTHENTICATED);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'Auth.ClearState',
      });
    });
  });
});