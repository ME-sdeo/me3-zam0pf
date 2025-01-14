// @ts-check

import { JwtPayload } from 'jsonwebtoken'; // version: 9.0.x
import { Request } from 'express'; // version: 4.18.x
import { IUserAuthInfo } from '../interfaces/user.interface';

/**
 * Enum defining user roles for role-based access control
 * Maps to authorization matrix defined in security specifications
 */
export enum UserRole {
    CONSUMER = 'consumer',  // Individual data providers
    COMPANY = 'company',    // Healthcare organizations
    ADMIN = 'admin',        // System administrators
    SYSTEM = 'system'       // System service accounts
}

/**
 * Enum defining supported MFA methods
 * Based on security considerations for multi-factor authentication
 */
export enum MFAMethod {
    AUTHENTICATOR = 'authenticator',  // Time-based one-time password (TOTP)
    SMS = 'sms',                      // SMS-based verification
    EMAIL = 'email'                   // Email-based verification
}

/**
 * Enum defining authentication token types
 * Supports Azure AD B2C token management
 */
export enum AuthTokenType {
    ACCESS = 'access',     // Short-lived access token
    REFRESH = 'refresh',   // Long-lived refresh token
    ID = 'id'             // OpenID Connect ID token
}

/**
 * Interface for authenticated user data
 * Implements HIPAA-compliant user authentication requirements
 */
export interface IAuthUser {
    id: string;                    // Unique user identifier
    email: string;                 // User email address
    role: UserRole;               // User role for RBAC
    mfaEnabled: boolean;          // MFA status flag
    mfaMethod: MFAMethod;         // Active MFA method
    permissions: string[];        // Granular permissions array
    lastActivity?: Date;          // Last user activity timestamp
    securityLevel?: number;       // User security clearance level
}

/**
 * Interface extending Express Request with authentication data
 * Supports secure session management and request tracking
 */
export interface IAuthRequest extends Request {
    user: IAuthUser;              // Authenticated user information
    token: string;                // Current session token
    sessionId: string;            // Unique session identifier
    mfaVerified?: boolean;        // MFA verification status
    ipAddress?: string;           // Request IP address
    userAgent?: string;           // User agent information
}

/**
 * Interface for authentication tokens
 * Implements Azure AD B2C token structure
 */
export interface IAuthTokens {
    accessToken: string;          // JWT access token
    refreshToken: string;         // Refresh token for token renewal
    idToken: string;             // OpenID Connect ID token
    expiresIn: number;           // Token expiration time in seconds
    tokenType: AuthTokenType;     // Type of authentication token
    scope?: string[];            // Token scope array
    issuedAt?: number;           // Token issuance timestamp
}

/**
 * Interface for custom JWT payload
 * Extends standard JWT payload with application-specific claims
 */
export interface ICustomJwtPayload extends JwtPayload {
    userId: string;              // User identifier
    role: UserRole;             // User role
    permissions: string[];       // User permissions
    mfaVerified?: boolean;      // MFA verification status
    sessionId?: string;         // Session identifier
}

/**
 * Interface for authentication middleware
 * Implements HIPAA-compliant request authentication
 */
export interface IAuthMiddleware {
    (req: IAuthRequest, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Interface for MFA verification request
 * Supports multiple MFA methods and verification types
 */
export interface IMFAVerificationRequest {
    userId: string;              // User identifier
    method: MFAMethod;          // MFA method to verify
    code: string;               // Verification code
    timestamp: number;          // Request timestamp
    attempt: number;            // Verification attempt count
}

/**
 * Interface for authentication configuration
 * Defines security settings and token parameters
 */
export interface IAuthConfig {
    jwtSecret: string;           // JWT signing secret
    jwtExpiresIn: number;        // JWT expiration time
    refreshTokenExpiration: number; // Refresh token lifetime
    mfaTimeoutSeconds: number;   // MFA verification timeout
    maxMfaAttempts: number;      // Maximum MFA attempts
    passwordPolicy: {            // Password security policy
        minLength: number;
        requireSpecialChar: boolean;
        requireNumber: boolean;
        requireUppercase: boolean;
        maxAge: number;
    };
}