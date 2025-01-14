/**
 * @fileoverview Type definitions and enums for healthcare companies in the MyElixir marketplace
 * Ensures type safety and data consistency across the application while maintaining
 * HIPAA/GDPR compliance requirements
 */

/**
 * Types of healthcare companies that can participate in the marketplace
 */
export enum CompanyType {
    RESEARCH_INSTITUTION = 'RESEARCH_INSTITUTION',
    PHARMACEUTICAL = 'PHARMACEUTICAL',
    BIOTECH = 'BIOTECH',
    HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
    MEDICAL_DEVICE = 'MEDICAL_DEVICE',
    CLINICAL_RESEARCH_ORGANIZATION = 'CLINICAL_RESEARCH_ORGANIZATION',
    HEALTH_TECH = 'HEALTH_TECH'
}

/**
 * Possible company account statuses with compliance considerations
 */
export enum CompanyStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING_REVIEW = 'PENDING_REVIEW',
    COMPLIANCE_HOLD = 'COMPLIANCE_HOLD'
}

/**
 * Company verification status states for compliance tracking
 */
export enum VerificationStatus {
    UNVERIFIED = 'UNVERIFIED',
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED',
    REQUIRES_ADDITIONAL_INFO = 'REQUIRES_ADDITIONAL_INFO'
}

/**
 * Required healthcare and security certifications for marketplace participation
 */
export enum CertificationType {
    HIPAA = 'HIPAA',
    GDPR = 'GDPR',
    ISO_27001 = 'ISO_27001',
    SOC2 = 'SOC2',
    IRB = 'IRB',
    FDA_COMPLIANCE = 'FDA_COMPLIANCE',
    HITECH = 'HITECH'
}

/**
 * Supported payment methods for marketplace transactions
 */
export enum PaymentMethodType {
    CREDIT_CARD = 'CREDIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    WIRE_TRANSFER = 'WIRE_TRANSFER',
    ACH = 'ACH'
}

/**
 * Standardized company address structure with geolocation support
 */
export type CompanyAddressType = {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
};

/**
 * Detailed certification tracking for compliance requirements
 */
export type CompanyCertificationType = {
    type: CertificationType;
    certificateNumber: string;
    issuingAuthority: string;
    issuedAt: Date;
    expiresAt: Date;
    documentUrls: string[];
    verificationStatus: VerificationStatus;
};

/**
 * Comprehensive company profile information
 */
export type CompanyProfileType = {
    legalName: string;
    tradingName: string;
    type: CompanyType;
    description: string;
    website: string;
    address: CompanyAddressType;
    contactEmail: string;
    phone: string;
    researchAreas: string[];
    certifications: CompanyCertificationType[];
    verificationStatus: VerificationStatus;
    status: CompanyStatus;
};

/**
 * Company billing information for marketplace transactions
 */
export type CompanyBillingType = {
    paymentMethod: PaymentMethodType;
    billingAddress: CompanyAddressType;
    taxId: string;
    vatNumber: string;
    billingEmail: string;
    billingCurrency: string;
};