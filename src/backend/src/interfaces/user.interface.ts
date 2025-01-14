// @ts-check
import { UUID } from 'crypto'; // version: latest - For cryptographically secure unique identifiers

/**
 * Enum defining user roles with comprehensive RBAC support
 * Based on the authorization matrix defined in security considerations
 */
export enum UserRole {
    CONSUMER = 'CONSUMER',      // Individual data providers
    COMPANY = 'COMPANY',        // Healthcare company representatives
    ADMIN = 'ADMIN',           // System administrators
    SYSTEM = 'SYSTEM'          // System service accounts
}

/**
 * Enum defining possible user account statuses for lifecycle management
 * Supports comprehensive user state tracking
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',                     // Fully verified and active account
    INACTIVE = 'INACTIVE',                 // Deactivated account
    SUSPENDED = 'SUSPENDED',               // Temporarily suspended account
    PENDING_VERIFICATION = 'PENDING_VERIFICATION'  // Awaiting email/identity verification
}

/**
 * Interface defining user profile information with HIPAA-compliant fields
 * Contains essential personal information while maintaining privacy standards
 */
export interface IUserProfile {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phone: string;
    address: string;
}

/**
 * Interface for user authentication details including MFA configuration
 * Supports Azure AD B2C integration with multi-factor authentication
 */
export interface IUserAuthInfo {
    userId: UUID;
    email: string;
    mfaEnabled: boolean;
    mfaMethod: 'AUTHENTICATOR' | 'SMS' | 'EMAIL';
    lastLogin: Date;
}

/**
 * Interface for user preferences including notification and privacy settings
 * Supports granular control over data sharing and communication preferences
 */
export interface IUserPreferences {
    notificationPreferences: string[];     // Types of notifications user wants to receive
    dataVisibility: string[];             // Default visibility settings for uploaded data
    defaultConsentDuration: number;        // Default duration for data sharing consent in days
}

/**
 * Comprehensive interface for complete user data structure
 * Implements all required fields for HIPAA-compliant user management
 */
export interface IUser {
    id: UUID;                             // Unique identifier for the user
    email: string;                        // Primary email address (unique)
    role: UserRole;                       // User's role in the system
    status: UserStatus;                   // Current account status
    profile: IUserProfile;                // Personal information
    authInfo: IUserAuthInfo;              // Authentication-related information
    preferences: IUserPreferences;         // User preferences and settings
    createdAt: Date;                      // Account creation timestamp
    updatedAt: Date;                      // Last update timestamp
}