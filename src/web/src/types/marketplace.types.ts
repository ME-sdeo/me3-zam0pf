import { FHIRResourceType } from './fhir.types';
import { UUID } from 'crypto'; // crypto latest

/**
 * Enumeration of possible data request statuses for lifecycle management
 * Tracks the complete lifecycle of a data request from creation to completion
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',           // Initial creation state
  ACTIVE = 'ACTIVE',         // Published and seeking matches
  MATCHING = 'MATCHING',     // Actively matching with providers
  COMPLETED = 'COMPLETED',   // All required matches found
  EXPIRED = 'EXPIRED',       // Request duration exceeded
  CANCELLED = 'CANCELLED'    // Manually terminated
}

/**
 * Enumeration of possible match result statuses for tracking match outcomes
 * Used to track the state of individual data matches
 */
export enum MatchStatus {
  PENDING = 'PENDING',     // Match identified, awaiting provider response
  ACCEPTED = 'ACCEPTED',   // Provider has granted access
  REJECTED = 'REJECTED'    // Provider has declined access
}

/**
 * Enumeration of possible marketplace transaction statuses for payment tracking
 * Tracks the financial transaction lifecycle
 */
export enum TransactionStatus {
  INITIATED = 'INITIATED',     // Payment process started
  PROCESSING = 'PROCESSING',   // Payment being processed
  COMPLETED = 'COMPLETED',     // Payment successfully completed
  FAILED = 'FAILED'           // Payment processing failed
}

/**
 * Type definition for demographic filter criteria with strict validation
 * Supports comprehensive demographic matching
 */
export type Demographics = {
  ageRange: {
    min: number;
    max: number;
  };
  gender: string[];
  ethnicity: string[];
  location: string[];
};

/**
 * Type definition for date range filter criteria with validation
 * Ensures proper temporal bounds for data requests
 */
export type DateRange = {
  startDate: Date;
  endDate: Date;
};

/**
 * Type definition for comprehensive data request filter criteria with validation
 * Defines all possible filtering options for data requests
 */
export type FilterCriteria = {
  resourceTypes: FHIRResourceType[];
  demographics: Demographics;
  conditions: string[];
  dateRange: DateRange;
};

/**
 * Type definition for a data request in the marketplace
 * Represents a complete data request with all necessary metadata
 */
export type DataRequest = {
  id: UUID;
  companyId: UUID;
  title: string;
  description: string;
  filterCriteria: FilterCriteria;
  pricePerRecord: number;
  recordsNeeded: number;
  status: RequestStatus;
  createdAt: Date;
  expiresAt: Date;
  matchCount: number;
};

/**
 * Type definition for a match between a data request and a provider
 * Tracks individual provider matches for a request
 */
export type RequestMatch = {
  id: UUID;
  requestId: UUID;
  providerId: UUID;
  matchScore: number;
  status: MatchStatus;
  createdAt: Date;
  respondedAt?: Date;
};

/**
 * Type definition for a marketplace transaction
 * Represents a financial transaction for data access
 */
export type MarketplaceTransaction = {
  id: UUID;
  requestId: UUID;
  providerId: UUID;
  companyId: UUID;
  amount: number;
  status: TransactionStatus;
  createdAt: Date;
  completedAt?: Date;
  blockchainRef?: string;
};

// Global constants for marketplace business rules
export const MIN_MATCH_SCORE = 0.7;
export const MIN_PRICE_PER_RECORD = 0.1;
export const MAX_REQUEST_DURATION_DAYS = 30;
export const MAX_RECORDS_PER_REQUEST = 10000;

/**
 * Type guard to validate FilterCriteria objects
 */
export const isValidFilterCriteria = (criteria: unknown): criteria is FilterCriteria => {
  if (!criteria || typeof criteria !== 'object') {
    return false;
  }

  const filter = criteria as Partial<FilterCriteria>;
  return (
    Array.isArray(filter.resourceTypes) &&
    filter.resourceTypes.every(type => typeof type === 'string') &&
    filter.demographics !== undefined &&
    Array.isArray(filter.conditions) &&
    filter.dateRange !== undefined &&
    filter.dateRange.startDate instanceof Date &&
    filter.dateRange.endDate instanceof Date
  );
};

/**
 * Type guard to validate DataRequest objects
 */
export const isValidDataRequest = (request: unknown): request is DataRequest => {
  if (!request || typeof request !== 'object') {
    return false;
  }

  const req = request as Partial<DataRequest>;
  return (
    typeof req.id === 'string' &&
    typeof req.companyId === 'string' &&
    typeof req.title === 'string' &&
    typeof req.description === 'string' &&
    isValidFilterCriteria(req.filterCriteria) &&
    typeof req.pricePerRecord === 'number' &&
    req.pricePerRecord >= MIN_PRICE_PER_RECORD &&
    typeof req.recordsNeeded === 'number' &&
    req.recordsNeeded <= MAX_RECORDS_PER_REQUEST &&
    Object.values(RequestStatus).includes(req.status as RequestStatus)
  );
};