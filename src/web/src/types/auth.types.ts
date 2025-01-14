import { AccountInfo } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0

/**
 * Enum defining user roles with strict access control levels.
 * Maps to backend RBAC permissions and Azure AD B2C role assignments.
 */
export enum UserRole {
    CONSUMER = 'CONSUMER',
    COMPANY = 'COMPANY',
    ADMIN = 'ADMIN',
    SYSTEM = 'SYSTEM'
}

/**
 * Enum defining supported Multi-Factor Authentication methods.
 * Extensible for future authentication method additions.
 */
export enum MFAMethod {
    SMS = 'SMS',
    AUTHENTICATOR_APP = 'AUTHENTICATOR_APP',
    BIOMETRIC = 'BIOMETRIC'
}

/**
 * Enum defining comprehensive authentication states.
 * Used for managing authentication flow and UI state.
 */
export enum AuthStatus {
    AUTHENTICATED = 'AUTHENTICATED',
    UNAUTHENTICATED = 'UNAUTHENTICATED',
    MFA_REQUIRED = 'MFA_REQUIRED',
    MFA_IN_PROGRESS = 'MFA_IN_PROGRESS',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    SESSION_EXPIRED = 'SESSION_EXPIRED'
}

/**
 * Enum defining detailed authentication error types.
 * Used for security incident handling and user feedback.
 */
export enum AuthError {
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    MFA_FAILED = 'MFA_FAILED',
    MFA_TIMEOUT = 'MFA_TIMEOUT',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
    UNAUTHORIZED = 'UNAUTHORIZED',
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
    SYSTEM_ERROR = 'SYSTEM_ERROR'
}

/**
 * Local storage key constants for authentication-related data.
 * Used consistently across the application for state management.
 */
export const AUTH_TOKEN_KEY = 'myelixir_auth_token';
export const REFRESH_TOKEN_KEY = 'myelixir_refresh_token';
export const MFA_SESSION_KEY = 'myelixir_mfa_session';
export const AUTH_STATE_KEY = 'myelixir_auth_state';

/**
 * Type guard to check if a value is a valid UserRole
 * @param value - The value to check
 */
export const isUserRole = (value: any): value is UserRole => {
    return Object.values(UserRole).includes(value);
};

/**
 * Type guard to check if a value is a valid MFAMethod
 * @param value - The value to check
 */
export const isMFAMethod = (value: any): value is MFAMethod => {
    return Object.values(MFAMethod).includes(value);
};

/**
 * Type guard to check if a value is a valid AuthStatus
 * @param value - The value to check
 */
export const isAuthStatus = (value: any): value is AuthStatus => {
    return Object.values(AuthStatus).includes(value);
};

/**
 * Type guard to check if a value is a valid AuthError
 * @param value - The value to check
 */
export const isAuthError = (value: any): value is AuthError => {
    return Object.values(AuthError).includes(value);
};

/**
 * Type alias for MSAL account info with additional MyElixir properties
 */
export type ExtendedAccountInfo = AccountInfo & {
    userRole: UserRole;
    mfaEnabled: boolean;
    preferredMFAMethod?: MFAMethod;
};

/**
 * Type for authentication event payload
 */
export type AuthEventPayload = {
    status: AuthStatus;
    error?: AuthError;
    accountInfo?: ExtendedAccountInfo;
};

/**
 * Type for MFA challenge response
 */
export type MFAChallengeResponse = {
    challengeId: string;
    method: MFAMethod;
    expiresAt: number;
};

/**
 * Type for MFA verification payload
 */
export type MFAVerificationPayload = {
    challengeId: string;
    code: string;
    method: MFAMethod;
};