/**
 * Company type classifications for healthcare organizations in the MyElixir marketplace
 * @enum {string}
 */
export enum CompanyType {
  RESEARCH = 'RESEARCH',
  PHARMACEUTICAL = 'PHARMACEUTICAL',
  HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
  BIOTECH = 'BIOTECH'
}

/**
 * Company account status for access control and activity tracking
 * @enum {string}
 */
export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Verification status states for company compliance tracking
 * @enum {string}
 */
export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

/**
 * Types of security and compliance certifications required for marketplace participation
 * @enum {string}
 */
export enum CertificationType {
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  ISO_27001 = 'ISO_27001',
  SOC2 = 'SOC2'
}

/**
 * Supported payment methods for marketplace transactions
 * @enum {string}
 */
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO'
}

/**
 * Structure for company physical and billing addresses
 * @interface
 */
export interface ICompanyAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Structure for tracking company compliance certifications
 * @interface
 */
export interface ICompanyCertification {
  type: CertificationType;
  number: string;
  issuedAt: Date;
  expiresAt: Date;
  verificationDocument: string;
}

/**
 * Company profile information including compliance contacts
 * @interface
 */
export interface ICompanyProfile {
  description: string;
  website: string;
  address: ICompanyAddress;
  phone: string;
  researchAreas: string[];
  certifications: ICompanyCertification[];
  complianceOfficer: string;
  complianceEmail: string;
}

/**
 * Company billing and payment information
 * @interface
 */
export interface ICompanyBilling {
  paymentMethod: PaymentMethod;
  billingAddress: ICompanyAddress;
  taxId: string;
  billingEmail: string;
  billingContact: string;
}

/**
 * Main company interface containing all company-related data
 * Implements HIPAA and GDPR compliance requirements for healthcare organizations
 * @interface
 */
export interface ICompany {
  id: string;
  name: string;
  email: string;
  type: CompanyType;
  status: CompanyStatus;
  verificationStatus: VerificationStatus;
  profile: ICompanyProfile;
  billingInfo: ICompanyBilling;
  createdAt: Date;
  updatedAt: Date;
  lastVerifiedAt: Date;
}