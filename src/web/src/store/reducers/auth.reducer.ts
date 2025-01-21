import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

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
  lastActivity: Date.now(),
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
      state.lastActivity = Date.now();
    },

    clearAuthState: (state) => {
      appInsights.trackEvent({ name: 'Auth.ClearState' });
      state.status = AuthStatus.UNAUTHENTICATED;
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.lastActivity = Date.now();
    },

    updateSecurityContext: (state, action: PayloadAction<{ lastActivity: number }>) => {
      state.lastActivity = Date.now();
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
        appInsights.trackEvent({ name: 'Auth.LoginAttempt' });
      })
      .addCase('auth/loginUser/fulfilled', (state, { payload }: PayloadAction<any>) => {
        if (payload.requiresMfa) {
          state.status = AuthStatus.MFA_REQUIRED;
        } else {
          state.status = AuthStatus.AUTHENTICATED;
          state.isAuthenticated = true;
        }
        state.user = payload.user;
        state.tokens = payload.tokens;
        state.sessionExpiry = Date.now() + payload.expiresIn;
        appInsights.trackEvent({
          name: 'Auth.LoginSuccess',
          properties: { requiresMfa: payload.requiresMfa },
        });
      })
      .addCase('auth/loginUser/rejected', (state, { payload }: PayloadAction<any>) => {
        state.status = AuthStatus.UNAUTHENTICATED;
        appInsights.trackException({
          error: new Error(payload?.message || AUTH_ERRORS.INVALID_CREDENTIALS),
          severityLevel: 2,
        });
      })

      // MFA verification flow
      .addCase('auth/verifyMfa/pending', (state) => {
        state.status = AuthStatus.MFA_IN_PROGRESS;
        appInsights.trackEvent({ name: 'Auth.MfaVerificationAttempt' });
      })
      .addCase('auth/verifyMfa/fulfilled', (state) => {
        state.status = AuthStatus.AUTHENTICATED;
        state.isAuthenticated = true;
        state.user = {
          ...state.user!,
          mfaVerified: true,
        };
        appInsights.trackEvent({ name: 'Auth.MfaVerificationSuccess' });
      })
      .addCase('auth/verifyMfa/rejected', (state, { payload }: PayloadAction<any>) => {
        appInsights.trackException({
          error: new Error(payload?.message || AUTH_ERRORS.MFA_REQUIRED),
          severityLevel: 2,
        });
      })

      // Token refresh flow
      .addCase('auth/refreshToken/fulfilled', (state, { payload }: PayloadAction<any>) => {
        state.tokens = payload.tokens;
        state.sessionExpiry = Date.now() + payload.expiresIn;
        state.lastActivity = Date.now();
        appInsights.trackEvent({ name: 'Auth.TokenRefreshSuccess' });
      })
      .addCase('auth/refreshToken/rejected', (state) => {
        state.status = AuthStatus.UNAUTHENTICATED;
        state.isAuthenticated = false;
        appInsights.trackEvent({ name: 'Auth.TokenRefreshFailed' });
      })

      // Logout flow
      .addCase('auth/logout/fulfilled', () => {
        appInsights.trackEvent({ name: 'Auth.LogoutSuccess' });
        return initialState;
      });
  },
});

// Export actions and reducer
export const { clearError, clearAuthState, updateSecurityContext } = authSlice.actions;
export default authSlice.reducer;

// Export selector for security context monitoring
export const selectSecurityContext = (state: { auth: IAuthState }) => ({
  lastActivity: state.auth.lastActivity
});