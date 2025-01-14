/**
 * @fileoverview TypeScript interfaces for healthcare companies in the MyElixir marketplace.
 * @version 1.0.0
 */

/**
 * Types of healthcare companies in the marketplace
 */
export enum CompanyType {
  RESEARCH_INSTITUTION = 'RESEARCH_INSTITUTION',
  PHARMACEUTICAL = 'PHARMACEUTICAL',
  BIOTECH = 'BIOTECH',
  HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
  MEDICAL_DEVICE = 'MEDICAL_DEVICE'
}

/**
 * Company account status values
 */
export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_REVIEW = 'PENDING_REVIEW'
}

/**
 * Company verification status values
 */
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

/**
 * Types of certifications required for compliance
 */
export enum CertificationType {
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  ISO_27001 = 'ISO_27001',
  SOC2 = 'SOC2',
  IRB = 'IRB'
}

/**
 * Supported payment methods for data transactions
 */
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WIRE_TRANSFER = 'WIRE_TRANSFER'
}

/**
 * Company address structure
 */
export interface ICompanyAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Company certification details
 */
export interface ICompanyCertification {
  type: CertificationType;
  number: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * Company profile information
 */
export interface ICompanyProfile {
  description: string;
  website: string;
  address: ICompanyAddress;
  phone: string;
  researchAreas: string[];
  certifications: ICompanyCertification[];
}

/**
 * Company billing information
 */
export interface ICompanyBilling {
  paymentMethod: PaymentMethod;
  billingAddress: ICompanyAddress;
  taxId: string;
}

/**
 * Main company interface representing a healthcare company
 * in the MyElixir marketplace
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
}