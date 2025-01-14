/**
 * @fileoverview Type definitions for authentication and authorization
 * Implements HIPAA-compliant authentication types for MyElixir healthcare data marketplace
 * @version 1.0.0
 */

import { JwtPayload } from 'jsonwebtoken'; // version: 9.0.x
import { Request } from 'express'; // version: 4.18.x
import { IAuthUser } from '../interfaces/auth.interface';

/**
 * Enum defining user roles for role-based access control
 * Maps to authorization matrix in security specifications
 */
export enum UserRole {
    CONSUMER = 'CONSUMER',  // Individual data providers
    COMPANY = 'COMPANY',    // Healthcare organizations
    ADMIN = 'ADMIN',        // System administrators
    SYSTEM = 'SYSTEM'       // System service accounts
}

/**
 * Enum defining supported multi-factor authentication methods
 * Based on security considerations section 7.1.3
 */
export enum MFAMethod {
    AUTHENTICATOR = 'AUTHENTICATOR',  // Time-based one-time password (TOTP)
    SMS = 'SMS',                      // SMS-based verification
    EMAIL = 'EMAIL'                   // Email-based verification
}

/**
 * Enum defining authentication token types
 * Supports Azure AD B2C token management
 */
export enum AuthTokenType {
    ACCESS = 'ACCESS',     // Short-lived access token
    REFRESH = 'REFRESH',   // Long-lived refresh token
    ID = 'ID'             // OpenID Connect ID token
}

/**
 * Type definition for JWT token payload with HIPAA-compliant claims
 * Extends standard JWT payload with application-specific security requirements
 */
export type AuthTokenPayload = JwtPayload & {
    userId: string;
    role: UserRole;
    mfaVerified: boolean;
    tokenVersion: number;
    scope: string[];
    region: string;
    consentId?: string;
    auditId: string;
};

/**
 * Type definition for MFA configuration
 * Implements comprehensive MFA settings based on security specifications
 */
export type MFAConfig = {
    method: MFAMethod;
    secret: string;
    verified: boolean;
    lastVerified: Date;
    backupCodes: string[];
    recoveryEmail: string;
    biometricEnabled: boolean;
};

/**
 * Type definition for login credentials
 * Supports multiple authentication factors and device-specific authentication
 */
export type LoginCredentials = {
    email: string;
    password: string;
    mfaToken?: string;
    deviceId?: string;
    biometricData?: string;
    region: string;
};

/**
 * Type definition for authentication token response
 * Implements Azure AD B2C token structure with HIPAA compliance
 */
export type TokenResponse = {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    tokenVersion: number;
    scope: string[];
    mfaRequired: boolean;
};

/**
 * Type definition for authentication request with security context
 * Extends Express Request type with authentication-specific properties
 */
export type AuthRequest = Request & {
    user: IAuthUser;
    token: string;
    mfaVerified: boolean;
    sessionId: string;
    ipAddress: string;
    deviceId?: string;
    auditContext: {
        requestId: string;
        timestamp: Date;
        source: string;
    };
};

/**
 * Type definition for authentication errors
 * Implements standardized error handling for authentication failures
 */
export type AuthError = {
    code: string;
    message: string;
    timestamp: Date;
    requestId: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    remediation?: string;
};

/**
 * Type definition for session metadata
 * Supports comprehensive session tracking and security monitoring
 */
export type SessionMetadata = {
    sessionId: string;
    userId: string;
    startTime: Date;
    lastActivity: Date;
    mfaVerified: boolean;
    deviceInfo: {
        id: string;
        userAgent: string;
        ipAddress: string;
        trusted: boolean;
    };
    securityContext: {
        authLevel: number;
        riskScore: number;
        anomalyDetected: boolean;
    };
};