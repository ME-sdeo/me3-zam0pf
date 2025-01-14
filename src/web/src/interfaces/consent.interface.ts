/**
 * @fileoverview Core interface definitions for consent management in the MyElixir healthcare data marketplace.
 * Implements granular permissions, blockchain integration, and comprehensive security controls.
 * @version 1.0.0
 */

import { UUID } from 'crypto';

/**
 * Enum defining possible access levels for consent permissions
 */
export enum ConsentAccessLevel {
  READ = 'READ',
  WRITE = 'WRITE',
  FULL = 'FULL',
  RESTRICTED = 'RESTRICTED'
}

/**
 * Enum defining encryption levels for data protection
 */
export enum EncryptionLevel {
  NONE = 'NONE',
  TRANSPORT = 'TRANSPORT',
  FIELD_LEVEL = 'FIELD_LEVEL',
  END_TO_END = 'END_TO_END'
}

/**
 * Enum defining the severity levels for consent validation
 */
export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * Interface defining time-based restrictions for consent
 */
export interface ITimeRestriction {
  startTime: Date;
  endTime: Date;
  timezone: string;
  recurrence?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

/**
 * Interface defining constraints for consent permissions
 */
export interface IConsentConstraints {
  timeRestrictions: ITimeRestriction[];
  ipRestrictions: string[];
  usageLimit: number;
}

/**
 * Interface defining granular consent permissions with encryption support
 */
export interface IConsentPermissions {
  resourceTypes: string[];
  accessLevel: ConsentAccessLevel;
  dataElements: string[];
  purpose: string;
  constraints: IConsentConstraints;
  encryptionLevel: EncryptionLevel;
}

/**
 * Enum defining possible states in the consent lifecycle
 */
export enum ConsentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Interface for consent validation results with detailed error tracking
 */
export interface IConsentValidation {
  isValid: boolean;
  errors: string[];
  severity: ValidationSeverity;
  fieldErrors: Record<string, string[]>;
}

/**
 * Comprehensive interface for consent records with blockchain integration
 */
export interface IConsent {
  id: UUID;
  userId: UUID;
  companyId: UUID;
  requestId: UUID;
  permissions: IConsentPermissions;
  validFrom: Date;
  validTo: Date;
  blockchainRef: string;
  status: ConsentStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  version: string;
}

/**
 * Allowed consent status transitions
 */
export const CONSENT_STATUS_TRANSITIONS: Record<ConsentStatus, ConsentStatus[]> = {
  [ConsentStatus.PENDING]: [ConsentStatus.ACTIVE, ConsentStatus.REVOKED],
  [ConsentStatus.ACTIVE]: [ConsentStatus.REVOKED, ConsentStatus.EXPIRED, ConsentStatus.SUSPENDED],
  [ConsentStatus.SUSPENDED]: [ConsentStatus.ACTIVE, ConsentStatus.REVOKED],
  [ConsentStatus.REVOKED]: [],
  [ConsentStatus.EXPIRED]: []
};

/**
 * Required fields for consent permissions validation
 */
export const REQUIRED_PERMISSION_FIELDS: (keyof IConsentPermissions)[] = [
  'resourceTypes',
  'accessLevel',
  'dataElements',
  'purpose',
  'encryptionLevel'
];

/**
 * Default encryption level for consent data
 */
export const DEFAULT_ENCRYPTION_LEVEL = EncryptionLevel.FIELD_LEVEL;