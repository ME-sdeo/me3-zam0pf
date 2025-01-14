import { FHIRResource } from './fhir.interface';
import { UUID } from 'crypto';

/**
 * Enum for comprehensive data request lifecycle status tracking
 * @version 1.0.0
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  MATCHING = 'MATCHING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW'
}

/**
 * Enum for detailed data match status tracking with compliance states
 * @version 1.0.0
 */
export enum MatchStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  COMPLIANCE_HOLD = 'COMPLIANCE_HOLD',
  CONSENT_REQUIRED = 'CONSENT_REQUIRED',
  PAYMENT_PENDING = 'PAYMENT_PENDING'
}

/**
 * Enum for blockchain-integrated marketplace transaction status
 * @version 1.0.0
 */
export enum TransactionStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW',
  BLOCKCHAIN_PENDING = 'BLOCKCHAIN_PENDING'
}

/**
 * Interface for audit event tracking
 */
export interface AuditEvent {
  timestamp: Date;
  action: string;
  performedBy: UUID;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Interface for payment processing information
 */
export interface PaymentInfo {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  processorRef: string;
  timestamp: Date;
}

/**
 * Enhanced interface for HIPAA-compliant healthcare data request management
 */
export interface DataRequest {
  id: UUID;
  companyId: UUID;
  title: string;
  description: string;
  filterCriteria: {
    resourceTypes: FHIRResource['resourceType'][];
    demographics: {
      ageRange: {
        min: number;
        max: number;
      };
      gender: string[];
      ethnicity: string[];
      location: string[];
      populationGroup: string[];
    };
    conditions: string[];
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    excludedFields: string[];
    complianceLevel: string;
    dataRetentionPeriod: number;
  };
  pricePerRecord: number;
  recordsNeeded: number;
  status: RequestStatus;
  complianceStatus: string;
  blockchainRef: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  auditTrail: AuditEvent[];
}

/**
 * Enhanced interface for secure health record matching with compliance tracking
 */
export interface DataMatch {
  id: UUID;
  requestId: UUID;
  resourceId: UUID;
  score: number;
  matchedCriteria: string[];
  complianceVerification: boolean;
  consentStatus: string;
  status: MatchStatus;
  blockchainRef: string;
  createdAt: Date;
  updatedAt: Date;
  auditTrail: AuditEvent[];
}

/**
 * Enhanced interface for blockchain-tracked marketplace transactions
 */
export interface MarketplaceTransaction {
  id: UUID;
  requestId: UUID;
  providerId: UUID;
  companyId: UUID;
  resourceIds: UUID[];
  amount: number;
  status: TransactionStatus;
  blockchainRef: string;
  complianceStatus: string;
  paymentDetails: PaymentInfo;
  createdAt: Date;
  completedAt: Date;
  auditTrail: AuditEvent[];
}

/**
 * System-wide marketplace constants
 */
export const MIN_MATCH_SCORE = 0.7;
export const MIN_PRICE_PER_RECORD = 0.1;
export const MAX_REQUEST_DURATION_DAYS = 30;
export const COMPLIANCE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const BLOCKCHAIN_CONFIRMATION_BLOCKS = 6;

/**
 * Helper type for request status values
 */
export const ALL_STATUS_VALUES: RequestStatus[] = Object.values(RequestStatus);

/**
 * Type guard for validating request status
 */
export function isValidRequestStatus(status: string): status is RequestStatus {
  return Object.values(RequestStatus).includes(status as RequestStatus);
}

/**
 * Type guard for validating match status
 */
export function isValidMatchStatus(status: string): status is MatchStatus {
  return Object.values(MatchStatus).includes(status as MatchStatus);
}

/**
 * Type guard for validating transaction status
 */
export function isValidTransactionStatus(status: string): status is TransactionStatus {
  return Object.values(TransactionStatus).includes(status as TransactionStatus);
}