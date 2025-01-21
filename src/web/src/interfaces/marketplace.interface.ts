import { UUID } from 'crypto'; // latest
import { RequestStatus, MatchStatus, TransactionStatus } from '../types/marketplace.types';
import { FHIR_RESOURCE_TYPES } from '../constants/fhir.constants';

/**
 * Interface for healthcare data request creation and management
 * Implements HIPAA-compliant data request specifications
 */
export interface IDataRequest {
  id: UUID;
  companyId: UUID;
  title: string;
  description: string;
  filterCriteria: {
    resourceTypes: Array<keyof typeof FHIR_RESOURCE_TYPES>;
    demographics: {
      ageRange: {
        min: number;
        max: number;
      };
      gender: string[];
      ethnicity: string[];
      location: string[];
    };
    conditions: string[];
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    excludedFields: string[];
    requiredFields: string[];
    customFilters: Record<string, unknown>;
  };
  pricePerRecord: number;
  recordsNeeded: number;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  auditLog: Array<{
    timestamp: Date;
    action: string;
    userId: UUID;
  }>;
}

/**
 * Interface for matching health records with data requests
 * Implements advanced scoring and matching algorithms
 */
export interface IDataMatch {
  id: UUID;
  requestId: UUID;
  resourceId: UUID;
  score: number;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  partialMatches: Array<{
    criterion: string;
    score: number;
  }>;
  status: MatchStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date;
  reviewedBy: UUID;
}

/**
 * Interface for blockchain-based marketplace transactions
 * Implements secure transaction tracking with audit trail
 */
export interface IMarketplaceTransaction {
  id: UUID;
  requestId: UUID;
  providerId: UUID;
  companyId: UUID;
  resourceIds: UUID[];
  amount: number;
  status: TransactionStatus;
  blockchainRef: string;
  transactionHash: string;
  smartContractAddress: string;
  createdAt: Date;
  processedAt: Date;
  completedAt: Date;
  auditTrail: Array<{
    timestamp: Date;
    status: TransactionStatus;
    details: string;
  }>;
}

// Global constants for marketplace business rules
export const MIN_MATCH_SCORE = 0.7;
export const MIN_PRICE_PER_RECORD = 0.1;
export const MAX_REQUEST_DURATION_DAYS = 30;
export const MAX_BATCH_SIZE = 1000;
export const MATCH_SCORE_WEIGHTS = {
  demographic: 0.3,
  condition: 0.4,
  date: 0.2,
  custom: 0.1
} as const;

/**
 * Type guard to validate IDataRequest objects
 */
export const isValidDataRequest = (request: unknown): request is IDataRequest => {
  if (!request || typeof request !== 'object') {
    return false;
  }

  const req = request as Partial<IDataRequest>;
  return (
    typeof req.id === 'string' &&
    typeof req.companyId === 'string' &&
    typeof req.title === 'string' &&
    typeof req.description === 'string' &&
    typeof req.pricePerRecord === 'number' &&
    req.pricePerRecord >= MIN_PRICE_PER_RECORD &&
    typeof req.recordsNeeded === 'number' &&
    req.recordsNeeded <= MAX_BATCH_SIZE &&
    req.filterCriteria !== undefined &&
    Array.isArray(req.filterCriteria.resourceTypes) &&
    req.filterCriteria.demographics !== undefined &&
    req.filterCriteria.dateRange !== undefined &&
    req.status !== undefined &&
    Object.values(RequestStatus).includes(req.status)
  );
};

/**
 * Type guard to validate IDataMatch objects
 */
export const isValidDataMatch = (match: unknown): match is IDataMatch => {
  if (!match || typeof match !== 'object') {
    return false;
  }

  const m = match as Partial<IDataMatch>;
  return (
    typeof m.id === 'string' &&
    typeof m.requestId === 'string' &&
    typeof m.resourceId === 'string' &&
    typeof m.score === 'number' &&
    m.score >= MIN_MATCH_SCORE &&
    Array.isArray(m.matchedCriteria) &&
    Array.isArray(m.unmatchedCriteria) &&
    Array.isArray(m.partialMatches) &&
    m.status !== undefined &&
    Object.values(MatchStatus).includes(m.status)
  );
};

/**
 * Type guard to validate IMarketplaceTransaction objects
 */
export const isValidMarketplaceTransaction = (transaction: unknown): transaction is IMarketplaceTransaction => {
  if (!transaction || typeof transaction !== 'object') {
    return false;
  }

  const tx = transaction as Partial<IMarketplaceTransaction>;
  return (
    typeof tx.id === 'string' &&
    typeof tx.requestId === 'string' &&
    typeof tx.providerId === 'string' &&
    typeof tx.companyId === 'string' &&
    Array.isArray(tx.resourceIds) &&
    typeof tx.amount === 'number' &&
    tx.amount > 0 &&
    typeof tx.blockchainRef === 'string' &&
    typeof tx.transactionHash === 'string' &&
    typeof tx.smartContractAddress === 'string' &&
    tx.status !== undefined &&
    Object.values(TransactionStatus).includes(tx.status)
  );
};