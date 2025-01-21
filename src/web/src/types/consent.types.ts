import { UUID } from 'crypto'; // latest
import { FHIRResourceType } from '../types/fhir.types';

/**
 * Enum defining possible consent record statuses
 * Tracks the lifecycle of consent records in the system
 */
export enum ConsentStatus {
  PENDING = 'PENDING',   // Initial state when consent is requested
  ACTIVE = 'ACTIVE',     // Consent is currently valid and in effect
  REVOKED = 'REVOKED',   // Consent was explicitly revoked by the user
  EXPIRED = 'EXPIRED'    // Consent has passed its validity period
}

/**
 * Enum defining granular access levels for consent permissions
 * Supports fine-grained control over data access
 */
export enum ConsentAccessLevel {
  READ = 'READ',       // Permission to view data only
  WRITE = 'WRITE',     // Permission to modify data
  FULL = 'FULL'        // Full access to data
}

/**
 * Types of consent requests supported by the system
 * Defines different temporal scopes for consent
 */
export enum ConsentRequestType {
  SINGLE_USE = 'SINGLE_USE',     // One-time access
  TIME_BOUND = 'TIME_BOUND',     // Access for a specific time period
  PERPETUAL = 'PERPETUAL'        // Indefinite access until revoked
}

/**
 * Types of events that can occur in a consent's lifecycle
 * Used for audit trail and blockchain tracking
 */
export enum ConsentEventType {
  CREATED = 'CREATED',   // New consent record created
  UPDATED = 'UPDATED',   // Consent details modified
  REVOKED = 'REVOKED',   // Consent explicitly revoked
  EXPIRED = 'EXPIRED'    // Consent reached end of validity
}

/**
 * Interface for consent permissions at the resource level
 * Enables granular control over specific FHIR resource types
 */
export interface ResourcePermission {
  resourceType: FHIRResourceType;
  accessLevel: ConsentAccessLevel;
  conditions?: Record<string, any>; // Additional access conditions
}

/**
 * Type for filtering consent records in the frontend
 * Supports comprehensive search and filtering capabilities
 */
export type ConsentFilter = {
  userId: UUID;
  companyId: UUID;
  resourceTypes: string[];
  validFrom: Date;
  validTo: Date;
  status: ConsentStatus;
};

/**
 * Type for consent validation results in the frontend
 * Provides detailed feedback on consent validity
 */
export type ConsentValidationResult = {
  isValid: boolean;
  errors: string[];
  blockchainStatus: boolean;
};

/**
 * Type for consent audit trail entries in the frontend
 * Supports comprehensive tracking of consent-related events
 */
export type ConsentAuditEntry = {
  consentId: UUID;
  eventType: ConsentEventType;
  blockchainRef: string;
  timestamp: Date;
  metadata: Record<string, any>;
};

/**
 * Global validation rules for consent management
 * Ensures consistent validation across the application
 */
export const CONSENT_VALIDATION_RULES = {
  MIN_VALIDITY_PERIOD_DAYS: 1,
  MAX_VALIDITY_PERIOD_DAYS: 365,
  REQUIRED_FIELDS: ['userId', 'companyId', 'resourceTypes', 'validFrom', 'validTo']
} as const;

/**
 * Valid status transitions for consent records
 * Enforces proper consent lifecycle management
 */
export const CONSENT_STATUS_TRANSITIONS: Record<ConsentStatus, ConsentStatus[]> = {
  [ConsentStatus.PENDING]: [ConsentStatus.ACTIVE, ConsentStatus.REVOKED],
  [ConsentStatus.ACTIVE]: [ConsentStatus.REVOKED, ConsentStatus.EXPIRED],
  [ConsentStatus.REVOKED]: [],
  [ConsentStatus.EXPIRED]: []
} as const;

/**
 * Type guard to check if a value is a valid ConsentStatus
 */
export const isConsentStatus = (value: string): value is ConsentStatus => {
  return Object.values(ConsentStatus).includes(value as ConsentStatus);
};

/**
 * Type guard to check if a value is a valid ConsentEventType
 */
export const isConsentEventType = (value: string): value is ConsentEventType => {
  return Object.values(ConsentEventType).includes(value as ConsentEventType);
};

/**
 * Type guard to check if a status transition is valid
 */
export const isValidStatusTransition = (
  currentStatus: ConsentStatus,
  newStatus: ConsentStatus
): boolean => {
  const allowedTransitions = CONSENT_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
};