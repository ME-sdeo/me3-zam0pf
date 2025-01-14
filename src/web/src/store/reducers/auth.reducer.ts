import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^1.9.0
import { ApplicationInsights } from '@microsoft/applicationinsights-web'; // @microsoft/applicationinsights-web ^2.8.0

import { AuthStatus } from '../../types/auth.types';
import { IAuthState } from '../../interfaces/auth.interface';
import { AUTH_ERRORS } from '../../constants/auth.constants';

// Initialize Application Insights for security logging
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.REACT_APP_APPINSIGHTS_KEY,
    enableAutoRouteTracking: true,
  }
});
appInsights.loadAppInsights();

// Define initial state with comprehensive security context
const initialState: IAuthState = {
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

// Create the auth slice with secure state management
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      appInsights.trackEvent({ name: 'Auth.ClearError' });
      state.error = null;
      state.securityContext.lastActivity = Date.now();
    },

    clearAuthState: (state) => {
      appInsights.trackEvent({ name: 'Auth.ClearState' });
      state.status = AuthStatus.UNAUTHENTICATED;
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.securityContext = {
        ...initialState.securityContext,
        lastActivity: Date.now(),
      };
      state.mfaState = initialState.mfaState;
    },

    updateSecurityContext: (state, action: PayloadAction<Partial<typeof state.securityContext>>) => {
      state.securityContext = {
        ...state.securityContext,
        ...action.payload,
        lastActivity: Date.now(),
      };
      appInsights.trackEvent({
        name: 'Auth.SecurityContextUpdate',
        properties: action.payload,
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // Login flow
      .addCase('auth/loginUser/pending', (state) => {
        state.status = AuthStatus.UNAUTHENTICATED;
        state.error = null;
        appInsights.trackEvent({ name: 'Auth.LoginAttempt' });
      })
      .addCase('auth/loginUser/fulfilled', (state, action) => {
        if (action.payload.requiresMfa) {
          state.status = AuthStatus.MFA_REQUIRED;
          state.mfaState = {
            verificationId: action.payload.verificationId,
            method: action.payload.mfaMethod,
            attempts: 0,
          };
        } else {
          state.status = AuthStatus.AUTHENTICATED;
          state.isAuthenticated = true;
        }
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.sessionExpiry = Date.now() + action.payload.expiresIn;
        appInsights.trackEvent({
          name: 'Auth.LoginSuccess',
          properties: { requiresMfa: action.payload.requiresMfa },
        });
      })
      .addCase('auth/loginUser/rejected', (state, action) => {
        state.status = AuthStatus.UNAUTHENTICATED;
        state.error = action.payload?.message || AUTH_ERRORS.INVALID_CREDENTIALS;
        appInsights.trackException({
          error: new Error(state.error),
          severityLevel: 2,
        });
      })

      // MFA verification flow
      .addCase('auth/verifyMfa/pending', (state) => {
        state.status = AuthStatus.MFA_IN_PROGRESS;
        appInsights.trackEvent({ name: 'Auth.MfaVerificationAttempt' });
      })
      .addCase('auth/verifyMfa/fulfilled', (state, action) => {
        state.status = AuthStatus.AUTHENTICATED;
        state.isAuthenticated = true;
        state.mfaState = initialState.mfaState;
        state.user = {
          ...state.user!,
          mfaVerified: true,
        };
        appInsights.trackEvent({ name: 'Auth.MfaVerificationSuccess' });
      })
      .addCase('auth/verifyMfa/rejected', (state, action) => {
        state.mfaState.attempts += 1;
        state.error = action.payload?.message || AUTH_ERRORS.MFA_REQUIRED;
        appInsights.trackException({
          error: new Error(state.error),
          severityLevel: 2,
          properties: { attempts: state.mfaState.attempts },
        });
      })

      // Token refresh flow
      .addCase('auth/refreshToken/fulfilled', (state, action) => {
        state.tokens = action.payload.tokens;
        state.sessionExpiry = Date.now() + action.payload.expiresIn;
        state.securityContext.lastActivity = Date.now();
        appInsights.trackEvent({ name: 'Auth.TokenRefreshSuccess' });
      })
      .addCase('auth/refreshToken/rejected', (state) => {
        state.status = AuthStatus.UNAUTHENTICATED;
        state.error = AUTH_ERRORS.TOKEN_EXPIRED;
        state.isAuthenticated = false;
        appInsights.trackEvent({ name: 'Auth.TokenRefreshFailed' });
      })

      // Logout flow
      .addCase('auth/logout/fulfilled', (state) => {
        appInsights.trackEvent({ name: 'Auth.LogoutSuccess' });
        return initialState;
      });
  },
});

// Export actions and reducer
export const { clearError, clearAuthState, updateSecurityContext } = authSlice.actions;
export default authSlice.reducer;

// Export selector for security context monitoring
export const selectSecurityContext = (state: { auth: IAuthState }) => state.auth.securityContext;