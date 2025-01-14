/**
 * @fileoverview Type definitions for the consent management system in MyElixir healthcare data marketplace
 * @version 1.0.0
 * @license MIT
 */

import { UUID } from 'crypto'; // latest
import { IConsent } from '../interfaces/consent.interface';
import { TransactionType } from '../types/blockchain.types';
import { FHIRResourceType } from '../types/fhir.types';

/**
 * Types of consent requests supported by the system
 */
export enum ConsentRequestType {
  SINGLE_USE = 'SINGLE_USE',
  TIME_BOUND = 'TIME_BOUND',
  PERPETUAL = 'PERPETUAL'
}

/**
 * Enhanced consent validation result structure with blockchain status
 */
export interface ConsentValidationResult {
  isValid: boolean;
  errors: string[];
  blockchainStatus: boolean;
  validationTimestamp: Date;
  warningMessages?: string[];
  validationMetrics?: {
    processingTimeMs: number;
    rulesValidated: number;
    blockchainLatencyMs: number;
  };
}

/**
 * Comprehensive types for consent lifecycle events
 */
export enum ConsentEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  BLOCKCHAIN_SYNCED = 'BLOCKCHAIN_SYNCED',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

/**
 * Enhanced type for filtering consent records with comprehensive search capabilities
 */
export type ConsentFilter = {
  userId?: UUID;
  companyId?: UUID;
  resourceTypes?: FHIRResourceType[];
  validFrom?: Date;
  validTo?: Date;
  requestType?: ConsentRequestType;
  isActive?: boolean;
  blockchainRef?: string;
  status?: string[];
  lastUpdatedRange?: {
    start: Date;
    end: Date;
  };
  searchText?: string;
  tags?: string[];
};

/**
 * Comprehensive type for consent audit trail entries with blockchain integration
 */
export type ConsentAuditLog = {
  consentId: UUID;
  eventType: ConsentEventType;
  blockchainRef: string;
  timestamp: Date;
  userId: UUID;
  companyId: UUID;
  affectedResources: FHIRResourceType[];
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  transactionType: TransactionType;
  validationDetails?: {
    rulesValidated: string[];
    validationErrors: string[];
    blockchainValidation: boolean;
  };
  systemMetadata?: {
    nodeId: string;
    processId: string;
    correlationId: string;
  };
};

/**
 * Validation rules for consent management
 */
export const CONSENT_VALIDATION_RULES = {
  MIN_VALIDITY_PERIOD_DAYS: 1,
  MAX_VALIDITY_PERIOD_DAYS: 365,
  REQUIRED_FIELDS: [
    'userId',
    'companyId',
    'resourceTypes',
    'validFrom',
    'validTo'
  ] as const,
  MAX_RESOURCE_TYPES: 50,
  ALLOWED_REQUEST_TYPES: [
    ConsentRequestType.SINGLE_USE,
    ConsentRequestType.TIME_BOUND,
    ConsentRequestType.PERPETUAL
  ] as const,
  BLOCKCHAIN_VALIDATION_TIMEOUT_MS: 5000,
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 1000,
  ALLOWED_IP_FORMATS: ['IPv4', 'IPv6'],
  MAX_CONCURRENT_CONSENTS: 100,
  REVOCATION_COOLDOWN_HOURS: 24
} as const;

/**
 * Event handlers for consent lifecycle management
 */
export const CONSENT_EVENT_HANDLERS = {
  CREATED: 'handleConsentCreated',
  UPDATED: 'handleConsentUpdated',
  REVOKED: 'handleConsentRevoked',
  EXPIRED: 'handleConsentExpired',
  BLOCKCHAIN_SYNC: 'handleBlockchainSync',
  VALIDATION_FAILED: 'handleValidationFailed'
} as const;

/**
 * Type for consent validation error details
 */
export type ConsentValidationError = {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  constraint?: keyof typeof CONSENT_VALIDATION_RULES;
  severity: 'ERROR' | 'WARNING';
  metadata?: Record<string, unknown>;
};

/**
 * Type for consent blockchain record
 */
export type ConsentBlockchainRecord = {
  consentId: UUID;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  eventType: ConsentEventType;
  metadata: {
    userId: UUID;
    companyId: UUID;
    resourceTypes: FHIRResourceType[];
    validFrom: Date;
    validTo: Date;
    requestType: ConsentRequestType;
  };
  signatures: {
    user: string;
    company: string;
    system: string;
  };
};

/**
 * Type for consent notification payload
 */
export type ConsentNotification = {
  type: ConsentEventType;
  consentId: UUID;
  userId: UUID;
  companyId: UUID;
  timestamp: Date;
  details: {
    resourceTypes: FHIRResourceType[];
    validFrom: Date;
    validTo: Date;
    requestType: ConsentRequestType;
    blockchainRef?: string;
  };
  channels: ('EMAIL' | 'SMS' | 'PUSH')[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
};