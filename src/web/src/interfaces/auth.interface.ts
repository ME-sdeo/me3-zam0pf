import { AccountInfo } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0
import { UserRole, MFAMethod, AuthStatus } from '../types/auth.types';

/**
 * Interface defining the comprehensive authentication state
 * Used for managing authentication across the application
 */
export interface IAuthState {
    isAuthenticated: boolean;
    status: AuthStatus;
    user: IAuthUser | null;
    tokens: IAuthTokens | null;
    lastActivity: number;
    sessionExpiry: number;
    error: string | null;
    securityContext: {
        deviceId: string;
        ipAddress: string;
        lastLocation: string | null;
    } | null;
    mfaState: {
        required: boolean;
        verified: boolean;
        method: MFAMethod | null;
        challengeId: string | null;
        expiresAt: number | null;
    } | null;
}

/**
 * Interface defining authenticated user information
 * Integrates with Azure AD B2C account management
 */
export interface IAuthUser {
    id: string;
    email: string;
    role: UserRole;
    mfaEnabled: boolean;
    mfaVerified: boolean;
    azureAccount: AccountInfo;
    lastLogin: number;
}

/**
 * Interface defining comprehensive token management
 * Supports Azure AD B2C token handling and refresh flows
 */
export interface IAuthTokens {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    tokenType: string;
    scope: string[];
}

/**
 * Interface defining MFA configuration
 * Supports multiple authentication methods with HIPAA compliance
 */
export interface IMFAConfig {
    method: MFAMethod;
    phoneNumber: string | null;
    secret: string | null;
    verified: boolean;
    lastVerified: number | null;
    recoveryCode: string[];
}

/**
 * Interface defining secure login credentials
 * Ensures GDPR-compliant handling of authentication data
 */
export interface ILoginCredentials {
    email: string;
    password: string;
    rememberMe: boolean;
    deviceFingerprint: string;
}