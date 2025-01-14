import { AccountInfo } from '@azure/msal-browser'; // @azure/msal-browser ^2.32.0
import { UserRole } from '../types/auth.types';

/**
 * Enum defining possible user account statuses
 * Used for account lifecycle management and access control
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * Interface defining address structure with HIPAA compliance
 */
interface AddressType {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isVerified: boolean;
}

/**
 * Interface defining emergency contact information
 */
interface EmergencyContactType {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    address?: AddressType;
}

/**
 * Interface defining notification settings
 */
interface NotificationSettings {
    email: boolean;
    sms: boolean;
    push: boolean;
    dataRequestAlerts: boolean;
    consentExpirationAlerts: boolean;
    securityAlerts: boolean;
    marketingCommunications: boolean;
}

/**
 * Interface defining data visibility preferences
 */
interface DataVisibilitySettings {
    profileVisibility: 'public' | 'private' | 'verified_only';
    dataAvailability: 'all' | 'selected' | 'none';
    anonymizedDataSharing: boolean;
    researchParticipation: boolean;
}

/**
 * Interface defining communication preferences
 */
interface CommunicationSettings {
    preferredLanguage: string;
    preferredContactMethod: 'email' | 'phone' | 'sms';
    doNotDisturb: boolean;
    doNotDisturbStart?: string;
    doNotDisturbEnd?: string;
}

/**
 * Interface defining security questions for account recovery
 */
interface SecurityQuestion {
    questionId: string;
    question: string;
    answer: string;
    lastUpdated: Date;
}

/**
 * Interface defining HIPAA-compliant user profile information
 */
export interface UserProfile {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phone: string;
    address: AddressType;
    emergencyContact: EmergencyContactType;
    language: string;
    timezone: string;
}

/**
 * Interface defining enhanced user preferences with privacy settings
 */
export interface UserPreferences {
    notificationPreferences: NotificationSettings;
    dataVisibility: DataVisibilitySettings;
    defaultConsentDuration: number; // in days
    dataRetentionPeriod: number; // in days
    communicationPreferences: CommunicationSettings;
}

/**
 * Comprehensive interface defining user data structure
 * Implements HIPAA compliance and security requirements
 */
export interface User {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profile: UserProfile;
    preferences: UserPreferences;
    mfaEnabled: boolean;
    lastLoginAt: Date;
    lastPasswordChangeAt: Date;
    securityQuestions: SecurityQuestion[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Constants for user management
 */
export const USER_ROLES: UserRole[] = [UserRole.CONSUMER, UserRole.COMPANY, UserRole.ADMIN];

export const USER_STATUSES: UserStatus[] = [
    UserStatus.ACTIVE,
    UserStatus.INACTIVE,
    UserStatus.SUSPENDED,
    UserStatus.PENDING_VERIFICATION
];

/**
 * Password policy constants
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

export const REQUIRED_PASSWORD_CHARS = {
    uppercase: true,
    lowercase: true,
    number: true,
    special: true
} as const;

/**
 * Type guard to check if a value is a valid UserStatus
 * @param value - The value to check
 */
export const isUserStatus = (value: any): value is UserStatus => {
    return Object.values(UserStatus).includes(value);
};

/**
 * Type guard to check if a user is active
 * @param user - The user to check
 */
export const isActiveUser = (user: User): boolean => {
    return user.status === UserStatus.ACTIVE;
};

/**
 * Type guard to check if a user requires MFA
 * @param user - The user to check
 */
export const requiresMFA = (user: User): boolean => {
    return user.mfaEnabled && user.role !== UserRole.SYSTEM;
};