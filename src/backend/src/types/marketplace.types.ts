import { FHIRResource } from '../interfaces/fhir.interface';
import { UUID } from 'crypto'; // v20.0.0

/**
 * Enum for data request status in the marketplace with audit support
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  MATCHING = 'MATCHING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  UNDER_REVIEW = 'UNDER_REVIEW'
}

/**
 * Enum for data match status with enhanced validation states
 */
export enum MatchStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  COMPLIANCE_HOLD = 'COMPLIANCE_HOLD'
}

/**
 * Enum for marketplace transaction status with blockchain states
 */
export enum TransactionStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  BLOCKCHAIN_CONFIRMED = 'BLOCKCHAIN_CONFIRMED',
  REFUNDED = 'REFUNDED'
}

/**
 * Enum for privacy levels in data requests
 */
export enum PrivacyLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  CONFIDENTIAL = 'CONFIDENTIAL',
  HIGHLY_CONFIDENTIAL = 'HIGHLY_CONFIDENTIAL'
}

/**
 * Enum for compliance levels
 */
export enum ComplianceLevel {
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  HITECH = 'HITECH'
}

/**
 * Interface for validation rules
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
}

/**
 * Interface for audit records
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
 * Type for demographic criteria in filter
 */
export type DemographicCriteria = {
  ageRange: {
    min: number;
    max: number;
    validation: { min: 0; max: 120 };
  };
  gender: string[];
  ethnicity: string[];
  location: string[];
  validationRules: Record<string, ValidationRule>;
};

/**
 * Type for condition criteria in filter
 */
export type ConditionCriteria = {
  codes: string[];
  system: string;
  version: string;
};

/**
 * Type for date range criteria
 */
export type DateRangeCriteria = {
  startDate: Date;
  endDate: Date;
  validation: { maxRange: number };
};

/**
 * Enhanced type for data request filter criteria with validation
 */
export type FilterCriteria = {
  resourceTypes: FHIRResource['resourceType'][];
  demographics: DemographicCriteria;
  conditions: ConditionCriteria;
  dateRange: DateRangeCriteria;
  excludedFields: string[];
  privacyLevel: PrivacyLevel;
};

/**
 * Enhanced type for data request objects with compliance tracking
 */
export type DataRequestType = {
  id: UUID;
  companyId: UUID;
  title: string;
  description: string;
  filterCriteria: FilterCriteria;
  pricePerRecord: number;
  recordsNeeded: number;
  status: RequestStatus;
  complianceLevel: ComplianceLevel;
  auditTrail: AuditRecord[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

/**
 * Type for match result with scoring
 */
export type MatchResult = {
  requestId: UUID;
  resourceId: UUID;
  matchScore: number;
  matchDetails: Record<string, number>;
  status: MatchStatus;
  validatedAt: Date;
};

/**
 * Type for marketplace transaction
 */
export type MarketplaceTransaction = {
  id: UUID;
  requestId: UUID;
  providerId: UUID;
  companyId: UUID;
  resourceIds: UUID[];
  amount: number;
  status: TransactionStatus;
  blockchainTxId?: string;
  createdAt: Date;
  completedAt?: Date;
  auditTrail: AuditRecord[];
};

// Global constants
export const MIN_MATCH_SCORE = 0.7;
export const MIN_PRICE_PER_RECORD = 0.1;
export const MAX_REQUEST_DURATION_DAYS = 30;
export const COMPLIANCE_LEVELS = {
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
  HITECH: 'HITECH'
} as const;

// Utility type for request status management
export const ALL_STATUSES: RequestStatus[] = Object.values(RequestStatus);

// Type guard for request status
export const isValidRequestStatus = (status: string): status is RequestStatus => {
  return Object.values(RequestStatus).includes(status as RequestStatus);
};

// Type guard for match status
export const isValidMatchStatus = (status: string): status is MatchStatus => {
  return Object.values(MatchStatus).includes(status as MatchStatus);
};

// Type guard for transaction status
export const isValidTransactionStatus = (status: string): status is TransactionStatus => {
  return Object.values(TransactionStatus).includes(status as TransactionStatus);
};