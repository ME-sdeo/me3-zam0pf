/**
 * Company type definitions and enums for MyElixir marketplace
 * @version 1.0.0
 * @package MyElixir
 */

/**
 * Enum defining types of healthcare companies in the marketplace
 */
export enum CompanyTypeEnum {
    RESEARCH_INSTITUTION = 'RESEARCH_INSTITUTION',
    PHARMACEUTICAL = 'PHARMACEUTICAL',
    BIOTECH = 'BIOTECH',
    HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
    MEDICAL_DEVICE = 'MEDICAL_DEVICE'
}

/**
 * Enum defining company account statuses
 */
export enum CompanyStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING_REVIEW = 'PENDING_REVIEW'
}

/**
 * Enum defining company verification statuses
 */
export enum VerificationStatus {
    UNVERIFIED = 'UNVERIFIED',
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED'
}

/**
 * Enum defining types of required certifications
 */
export enum CertificationType {
    HIPAA = 'HIPAA',
    GDPR = 'GDPR',
    ISO_27001 = 'ISO_27001',
    SOC2 = 'SOC2',
    IRB = 'IRB'
}

/**
 * Enum defining supported payment methods
 */
export enum PaymentMethodType {
    CREDIT_CARD = 'CREDIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    WIRE_TRANSFER = 'WIRE_TRANSFER'
}

/**
 * Type definition for standardized company address
 */
export type CompanyAddressType = {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
};

/**
 * Type definition for company certification tracking
 */
export type CompanyCertificationType = {
    type: CertificationType;
    number: string;
    issuedAt: Date;
    expiresAt: Date;
    verificationDocument: string;
    lastVerifiedAt: Date;
};

/**
 * Type definition for company profile information
 */
export type CompanyProfileType = {
    description: string;
    website: string;
    address: CompanyAddressType;
    phone: string;
    researchAreas: string[];
    certifications: CompanyCertificationType[];
    dataUsagePolicy: string;
    privacyPolicy: string;
};

/**
 * Type definition for company billing information
 */
export type CompanyBillingType = {
    paymentMethod: PaymentMethodType;
    billingAddress: CompanyAddressType;
    taxId: string;
    billingEmail: string;
    billingContact: string;
};

/**
 * Main type definition for company data structure
 */
export type Company = {
    id: string;
    name: string;
    email: string;
    type: CompanyTypeEnum;
    status: CompanyStatus;
    verificationStatus: VerificationStatus;
    profile: CompanyProfileType;
    billingInfo: CompanyBillingType;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date;
    lastVerifiedAt: Date;
    dataAccessLevel: string;
    complianceStatus: string;
};