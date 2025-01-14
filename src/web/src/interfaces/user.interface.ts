import { AccountInfo } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0
import { UserRole } from '../types/auth.types';

/**
 * Enum defining all possible user account statuses in the system.
 * Used for account lifecycle management and access control.
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * Interface defining HIPAA-compliant user profile information.
 * Contains essential personal information with strict data protection requirements.
 */
export interface IUserProfile {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phone: string;
    address: string;
    /** Additional HIPAA-compliant fields */
    medicalRecordNumber?: string;
    preferredLanguage?: string;
    emergencyContact?: {
        name: string;
        relationship: string;
        phone: string;
    };
    lastHIPAAConsentDate?: Date;
}

/**
 * Interface defining comprehensive user preferences for platform interaction.
 * Includes notification, data visibility, and consent management settings.
 */
export interface IUserPreferences {
    notificationPreferences: {
        email: boolean;
        sms: boolean;
        push: boolean;
        types: string[]; // Types of notifications user wants to receive
    };
    dataVisibility: {
        profileVisibility: 'public' | 'private' | 'selective';
        allowedDataTypes: string[]; // Types of health data user is willing to share
        restrictedCompanies?: string[]; // Companies explicitly restricted from accessing data
    };
    defaultConsentDuration: number; // Default consent duration in days
    marketplacePreferences: {
        minimumCompensation: number;
        autoMatchEnabled: boolean;
        preferredDataTypes: string[];
    };
    privacySettings: {
        dataRetentionPeriod: number;
        anonymizeData: boolean;
        dataUsageRestrictions: string[];
    };
}

/**
 * Interface defining security and authentication settings for a user.
 * Implements comprehensive security controls aligned with HIPAA requirements.
 */
export interface IUserSecurity {
    mfaEnabled: boolean;
    mfaMethod?: string;
    lastPasswordChange: Date;
    securityQuestions?: {
        question: string;
        hashedAnswer: string;
    }[];
    loginAttempts: number;
    lastLoginDate?: Date;
    lastFailedLogin?: Date;
    ipWhitelist?: string[];
}

/**
 * Main interface defining the complete user data structure.
 * Implements full user management capabilities with security and compliance support.
 */
export interface IUser {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profile: IUserProfile;
    preferences: IUserPreferences;
    security: IUserSecurity;
    mfaEnabled: boolean;
    azureAdB2C: {
        objectId: string;
        accountInfo: AccountInfo;
    };
    compliance: {
        hipaaConsentStatus: boolean;
        lastComplianceCheck: Date;
        dataProcessingConsent: boolean;
        marketingConsent: boolean;
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        lastActive: Date;
        verificationStatus: {
            email: boolean;
            phone: boolean;
            identity: boolean;
        };
    };
}

/**
 * Type guard to check if a value is a valid UserStatus
 * @param value - The value to check
 */
export const isUserStatus = (value: any): value is UserStatus => {
    return Object.values(UserStatus).includes(value);
};

/**
 * Type for user update operations with partial fields
 */
export type UserUpdatePayload = Partial<Omit<IUser, 'id' | 'email' | 'role' | 'createdAt'>>;

/**
 * Type for user creation with required fields
 */
export type UserCreatePayload = Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for user search/filter parameters
 */
export interface IUserSearchParams {
    status?: UserStatus;
    role?: UserRole;
    createdDateRange?: {
        start: Date;
        end: Date;
    };
    verificationStatus?: boolean;
    mfaEnabled?: boolean;
}