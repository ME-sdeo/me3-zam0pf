/**
 * @fileoverview Core interface definitions for the consent management system
 * @version 1.0.0
 * @license MIT
 */

import { UUID } from 'crypto'; // latest

/**
 * Core interface for consent records with blockchain tracking and audit capabilities
 * Implements HIPAA/GDPR-compliant granular access controls
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
}

/**
 * Interface for granular consent permissions with field-level access control
 * Defines the specific access rights and constraints for data sharing
 */
export interface IConsentPermissions {
  resourceTypes: string[];
  accessLevel: ConsentAccessLevel;
  dataElements: string[];
  purpose: string;
  constraints: IConsentConstraints;
}

/**
 * Interface for additional consent constraints including time and usage restrictions
 */
export interface IConsentConstraints {
  timeRestrictions: {
    startTime: string;
    endTime: string;
  }[];
  ipRestrictions: string[];
  usageLimit: number;
}

/**
 * Interface for consent validation results with detailed error reporting
 */
export interface IConsentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validationTimestamp: Date;
}

/**
 * Enum for consent record statuses with strict state transitions
 */
export enum ConsentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED'
}

/**
 * Enum for consent access levels with granular control
 */
export enum ConsentAccessLevel {
  READ = 'READ',
  WRITE = 'WRITE',
  FULL = 'FULL'
}

/**
 * Valid state transitions for consent status
 */
export const CONSENT_STATUS_TRANSITIONS: Record<ConsentStatus, ConsentStatus[]> = {
  [ConsentStatus.PENDING]: [ConsentStatus.ACTIVE, ConsentStatus.REVOKED],
  [ConsentStatus.ACTIVE]: [ConsentStatus.REVOKED, ConsentStatus.EXPIRED],
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
  'purpose'
];

/**
 * Valid FHIR resource types that can be included in consent permissions
 */
export const VALID_FHIR_RESOURCE_TYPES: string[] = [
  'Patient',
  'Observation',
  'Condition',
  'Procedure',
  'MedicationStatement'
];

/**
 * Default duration for consent validity in days
 */
export const DEFAULT_CONSENT_DURATION_DAYS = 365;