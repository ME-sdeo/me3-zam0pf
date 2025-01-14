import { PaymentIntent } from '@types/stripe'; // v8.0.417
import { UUID } from 'crypto'; // latest
import { TransactionStatus } from './marketplace.types';
import { BlockchainTransaction } from './blockchain.types';

/**
 * Enum for supported payment currencies with ISO 4217 codes
 */
export enum PaymentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

/**
 * Enum for supported payment methods
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

/**
 * Enum for compliance levels in payment processing
 */
export enum ComplianceLevel {
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  HITECH = 'HITECH',
  PCI_DSS = 'PCI_DSS'
}

/**
 * Interface for payment amount with currency
 */
export interface PaymentAmount {
  amount: number;
  currency: PaymentCurrency;
}

/**
 * Interface for security context in payment processing
 */
export interface SecurityContext {
  encryptionLevel: string;
  ipAddress: string;
  userAgent: string;
  geoLocation: string;
  riskScore: number;
}

/**
 * Interface for compliance violation details
 */
export interface ComplianceViolation {
  code: string;
  regulation: ComplianceLevel;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  remediation: string;
}

/**
 * Interface for regulatory check results
 */
export interface RegulatoryCheck {
  type: ComplianceLevel;
  passed: boolean;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Interface for risk assessment results
 */
export interface RiskAssessment {
  score: number;
  factors: string[];
  recommendations: string[];
  timestamp: Date;
}

/**
 * Interface for audit record in payment transactions
 */
export interface AuditRecord {
  timestamp: Date;
  action: string;
  userId: UUID;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Enhanced interface for payment transactions with security and compliance tracking
 */
export interface PaymentTransaction {
  id: UUID;
  paymentIntentId: string;
  requestId: UUID;
  amount: PaymentAmount;
  method: PaymentMethodType;
  status: TransactionStatus;
  blockchainRef: string;
  securityHash: string;
  complianceLevel: ComplianceLevel;
  auditTrail: AuditRecord[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for payment processing errors with security context
 */
export type PaymentError = {
  code: string;
  message: string;
  securityContext: SecurityContext;
  complianceViolation?: ComplianceViolation;
  details: Record<string, any>;
};

/**
 * Type for payment validation errors with regulatory checks
 */
export type PaymentValidationError = PaymentError & {
  validationErrors: string[];
  regulatoryChecks: RegulatoryCheck[];
  riskAssessment: RiskAssessment;
};

// Global constants for payment processing
export const DEFAULT_CURRENCY = PaymentCurrency.USD;
export const MIN_TRANSACTION_AMOUNT = 0.50;
export const MAX_TRANSACTION_AMOUNT = 50000.00;

/**
 * Type guard for payment method validation
 */
export const isValidPaymentMethod = (method: string): method is PaymentMethodType => {
  return Object.values(PaymentMethodType).includes(method as PaymentMethodType);
};

/**
 * Type guard for compliance level validation
 */
export const isValidComplianceLevel = (level: string): level is ComplianceLevel => {
  return Object.values(ComplianceLevel).includes(level as ComplianceLevel);
};