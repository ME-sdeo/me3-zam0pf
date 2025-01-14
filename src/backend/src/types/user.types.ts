import { UUID } from 'crypto'; // version: latest
import { IUser, UserRole, UserStatus } from '../interfaces/user.interface';

/**
 * Interface for HIPAA-compliant data sharing preferences
 * Defines granular control over health data access
 */
interface IDataSharingPreferences {
    dataCategories: string[];              // Categories of health data to share
    purposeOfUse: string[];               // Allowed purposes for data usage
    retentionPeriod: number;              // Data retention period in days
    monetizationEnabled: boolean;         // Whether data can be monetized
    minimumCompensation: number;          // Minimum compensation per record
}

/**
 * Interface for company profile with compliance requirements
 */
interface ICompanyProfile {
    companyName: string;
    registrationNumber: string;
    businessType: string;
    industryCategory: string;
    researchPurpose: string[];
    dataUsageIntent: string;
}

/**
 * Interface for compliance certifications
 */
interface IComplianceCertifications {
    hipaaCompliance: boolean;
    gdprCompliance: boolean;
    certificationIds: string[];
    validUntil: Date;
    auditHistory: Array<{
        date: Date;
        type: string;
        result: string;
    }>;
}

/**
 * Interface for admin privileges
 */
interface IAdminPrivileges {
    accessLevel: 'FULL' | 'LIMITED';
    allowedOperations: string[];
    auditCapabilities: boolean;
    systemConfigAccess: boolean;
}

/**
 * Interface for MFA settings
 */
interface IMFASettings {
    enabled: boolean;
    method: 'AUTHENTICATOR' | 'SMS' | 'EMAIL';
    backupCodes: string[];
    lastVerified: Date;
}

/**
 * Interface for HIPAA-compliant fields
 */
interface IHIPAACompliantFields {
    hipaaAcknowledgement: boolean;
    dataEncryptionEnabled: boolean;
    auditLoggingEnabled: boolean;
    privacyNoticeAccepted: Date;
}

/**
 * Type definition for different user categories
 */
export type UserType = {
    Consumer: IUser & {
        role: UserRole.CONSUMER;
        hipaaConsent: boolean;
        dataPreferences: IDataSharingPreferences;
    };
    Company: IUser & {
        role: UserRole.COMPANY;
        companyDetails: ICompanyProfile;
        complianceCertifications: IComplianceCertifications;
    };
    Admin: IUser & {
        role: UserRole.ADMIN;
        adminPrivileges: IAdminPrivileges;
    };
};

/**
 * Type for user update operations with partial fields
 */
export type UserUpdatePayload = {
    profile?: Partial<IUserProfile & IHIPAACompliantFields>;
    preferences?: Partial<IUserPreferences & IDataSharingPreferences>;
    mfaSettings?: Partial<IMFASettings>;
};

/**
 * Type for user creation with required fields
 */
export type UserCreatePayload = {
    email: string;
    role: UserRole;
    profile: IUserProfile & IHIPAACompliantFields;
    hipaaConsent: boolean;
    mfaSettings: IMFASettings;
    preferences: IUserPreferences & IDataSharingPreferences;
};

/**
 * Type for user query parameters
 */
export type UserQueryParams = {
    role?: UserRole;
    status?: UserStatus;
    page?: number;
    limit?: number;
    complianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
};

/**
 * Type for user sorting keys
 */
export type UserSortKey = 'createdAt' | 'email' | 'role' | 'status' | 'complianceStatus';

/**
 * Type guards for user type checking
 */
export type UserTypeGuards = {
    isConsumer: (user: IUser) => user is UserType['Consumer'];
    isCompany: (user: IUser) => user is UserType['Company'];
    isAdmin: (user: IUser) => user is UserType['Admin'];
};

/**
 * Type for user compliance status
 */
export type ComplianceStatus = {
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    lastChecked: Date;
    violations: string[];
    remediationSteps: string[];
};

/**
 * Type for user audit log entry
 */
export type UserAuditLogEntry = {
    timestamp: Date;
    action: string;
    performedBy: UUID;
    details: Record<string, unknown>;
    ipAddress: string;
    userAgent: string;
};