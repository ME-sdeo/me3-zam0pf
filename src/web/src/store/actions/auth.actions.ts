import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import { ApplicationInsights } from '@microsoft/applicationinsights-web'; // ^2.8.0

import { ILoginCredentials, IMFAConfig } from '../../interfaces/auth.interface';
import { AuthService } from '../../services/auth.service';
import { AuthError, AuthStatus, MFAMethod } from '../../types/auth.types';

// Initialize Application Insights for security monitoring
const appInsights = new ApplicationInsights({
    config: {
        instrumentationKey: process.env.REACT_APP_APPINSIGHTS_KEY,
        enableAutoRouteTracking: true,
        enableCorsCorrelation: true
    }
});
appInsights.loadAppInsights();

/**
 * Security monitoring wrapper for tracking authentication events
 * @param eventName Security event name
 * @param properties Event properties
 */
const trackSecurityEvent = (eventName: string, properties?: Record<string, any>) => {
    appInsights.trackEvent({
        name: `Security.Auth.${eventName}`,
        properties: {
            ...properties,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            sessionId: sessionStorage.getItem('sessionId')
        }
    });
};

/**
 * Async thunk for user login with enhanced security monitoring
 */
export const loginUser = createAsyncThunk(
    'auth/login',
    async (credentials: ILoginCredentials, { rejectWithValue }) => {
        try {
            trackSecurityEvent('LoginAttempt', {
                email: credentials.email,
                rememberMe: credentials.rememberMe
            });

            const authService = new AuthService(
                window.msalInstance,
                {
                    b2cTenantName: process.env.REACT_APP_B2C_TENANT_NAME!,
                    clientId: process.env.REACT_APP_CLIENT_ID!,
                    apiScopes: ['user.read', 'data.write']
                }
            );

            await authService.login(credentials);
            const authState = await new Promise((resolve) => {
                const subscription = authService.getAuthState().subscribe(state => {
                    subscription.unsubscribe();
                    resolve(state);
                });
            });

            trackSecurityEvent('LoginSuccess', {
                userId: (authState as any).user?.id,
                mfaEnabled: (authState as any).user?.mfaEnabled
            });

            return authState;
        } catch (error: any) {
            trackSecurityEvent('LoginFailure', {
                error: error.message,
                errorCode: error.errorCode
            });

            return rejectWithValue({
                error: error.message,
                code: error instanceof Error ? AuthError.INVALID_CREDENTIALS : error.errorCode
            });
        }
    }
);

/**
 * Async thunk for MFA setup with security validation
 */
export const setupMFA = createAsyncThunk(
    'auth/setupMFA',
    async (mfaConfig: IMFAConfig, { rejectWithValue }) => {
        try {
            trackSecurityEvent('MFASetupInitiated', {
                method: mfaConfig.method
            });

            const authService = new AuthService(
                window.msalInstance,
                {
                    b2cTenantName: process.env.REACT_APP_B2C_TENANT_NAME!,
                    clientId: process.env.REACT_APP_CLIENT_ID!,
                    apiScopes: ['user.read', 'mfa.setup']
                }
            );

            const result = await authService.setupMFA(mfaConfig.method);

            trackSecurityEvent('MFASetupSuccess', {
                method: mfaConfig.method,
                challengeId: result.challengeId
            });

            return result;
        } catch (error: any) {
            trackSecurityEvent('MFASetupFailure', {
                error: error.message,
                method: mfaConfig.method
            });

            return rejectWithValue({
                error: error.message,
                code: AuthError.MFA_FAILED
            });
        }
    }
);

/**
 * Async thunk for MFA verification with security monitoring
 */
export const verifyMFA = createAsyncThunk(
    'auth/verifyMFA',
    async ({ challengeId, code, method }: { challengeId: string; code: string; method: MFAMethod }, { rejectWithValue }) => {
        try {
            trackSecurityEvent('MFAVerificationAttempt', {
                method,
                challengeId
            });

            const authService = new AuthService(
                window.msalInstance,
                {
                    b2cTenantName: process.env.REACT_APP_B2C_TENANT_NAME!,
                    clientId: process.env.REACT_APP_CLIENT_ID!,
                    apiScopes: ['user.read', 'mfa.verify']
                }
            );

            const success = await authService.verifyMFAChallenge({
                challengeId,
                code,
                method
            });

            if (success) {
                trackSecurityEvent('MFAVerificationSuccess', {
                    method,
                    challengeId
                });
                return { status: AuthStatus.AUTHENTICATED };
            }

            throw new Error(AuthError.MFA_FAILED);
        } catch (error: any) {
            trackSecurityEvent('MFAVerificationFailure', {
                error: error.message,
                method,
                challengeId
            });

            return rejectWithValue({
                error: error.message,
                code: AuthError.MFA_FAILED
            });
        }
    }
);

/**
 * Async thunk for token refresh with security monitoring
 */
export const refreshTokens = createAsyncThunk(
    'auth/refreshTokens',
    async (_, { rejectWithValue }) => {
        try {
            trackSecurityEvent('TokenRefreshAttempt');

            const authService = new AuthService(
                window.msalInstance,
                {
                    b2cTenantName: process.env.REACT_APP_B2C_TENANT_NAME!,
                    clientId: process.env.REACT_APP_CLIENT_ID!,
                    apiScopes: ['user.read']
                }
            );

            const authState = await new Promise((resolve) => {
                const subscription = authService.getAuthState().subscribe(state => {
                    subscription.unsubscribe();
                    resolve(state);
                });
            });

            trackSecurityEvent('TokenRefreshSuccess');
            return authState;
        } catch (error: any) {
            trackSecurityEvent('TokenRefreshFailure', {
                error: error.message
            });

            return rejectWithValue({
                error: error.message,
                code: AuthError.TOKEN_EXPIRED
            });
        }
    }
);

/**
 * Async thunk for user logout with security audit
 */
export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            trackSecurityEvent('LogoutInitiated');

            const authService = new AuthService(
                window.msalInstance,
                {
                    b2cTenantName: process.env.REACT_APP_B2C_TENANT_NAME!,
                    clientId: process.env.REACT_APP_CLIENT_ID!,
                    apiScopes: ['user.read']
                }
            );

            await authService.logout();
            trackSecurityEvent('LogoutSuccess');

            return { status: AuthStatus.UNAUTHENTICATED };
        } catch (error: any) {
            trackSecurityEvent('LogoutFailure', {
                error: error.message
            });

            return rejectWithValue({
                error: error.message,
                code: AuthError.SYSTEM_ERROR
            });
        }
    }
);