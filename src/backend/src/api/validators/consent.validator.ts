/**
 * @fileoverview Consent validator implementation for MyElixir healthcare data marketplace
 * Ensures HIPAA compliance and blockchain integration for consent operations
 * @version 1.0.0
 * @license MIT
 */

import { validate, isUUID, IsDate } from 'class-validator'; // ^0.14.0
import { 
  IConsent, 
  IConsentPermissions, 
  ConsentAccessLevel,
  VALID_FHIR_RESOURCE_TYPES 
} from '../../interfaces/consent.interface';
import { 
  ConsentValidationResult,
  ConsentValidationError,
  CONSENT_VALIDATION_RULES 
} from '../../types/consent.types';
import { CONSENT_VALIDATION } from '../../constants/validation.constants';
import { isValidResourceType } from '../../types/fhir.types';

// Required fields for consent validation
const REQUIRED_FIELDS = [
  'userId',
  'companyId',
  'requestId',
  'permissions',
  'validFrom',
  'validTo'
] as const;

// Validation error messages
const VALIDATION_ERRORS = {
  INVALID_UUID: 'Invalid UUID format for field: {field}',
  INVALID_DURATION: 'Consent duration must be between {min} and {max} days',
  INVALID_DATES: 'Valid from date must be before valid to date and not in the past',
  MISSING_REQUIRED_FIELD: 'Missing required field: {field}',
  INVALID_RESOURCE_TYPE: 'Invalid FHIR resource type: {type}',
  INVALID_ACCESS_LEVEL: 'Invalid access level: {level}',
  INVALID_BLOCKCHAIN_REF: 'Invalid blockchain reference format',
  CONFLICTING_PERMISSIONS: 'Conflicting permission settings detected'
} as const;

/**
 * Validates a consent record against HIPAA compliance rules and business logic
 * @param consent - The consent record to validate
 * @returns Promise<ConsentValidationResult> - Validation result with errors if any
 */
export async function validateConsent(consent: IConsent): Promise<ConsentValidationResult> {
  const errors: string[] = [];
  
  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!consent[field]) {
      errors.push(VALIDATION_ERRORS.MISSING_REQUIRED_FIELD.replace('{field}', field));
    }
  }

  // Validate UUID formats
  const uuidFields = ['userId', 'companyId', 'requestId'];
  for (const field of uuidFields) {
    if (consent[field] && !isUUID(consent[field])) {
      errors.push(VALIDATION_ERRORS.INVALID_UUID.replace('{field}', field));
    }
  }

  // Validate consent duration
  const durationValidation = await validateConsentDuration(consent.validFrom, consent.validTo);
  if (!durationValidation.isValid) {
    errors.push(...durationValidation.errors);
  }

  // Validate permissions
  const permissionsValidation = await validateConsentPermissions(consent.permissions);
  if (!permissionsValidation.isValid) {
    errors.push(...permissionsValidation.errors);
  }

  // Validate blockchain reference if present
  if (consent.blockchainRef && !validateBlockchainRef(consent.blockchainRef)) {
    errors.push(VALIDATION_ERRORS.INVALID_BLOCKCHAIN_REF);
  }

  return {
    isValid: errors.length === 0,
    errors,
    blockchainStatus: true,
    validationTimestamp: new Date(),
    validationMetrics: {
      processingTimeMs: 0,
      rulesValidated: REQUIRED_FIELDS.length + 3, // Basic fields + duration + permissions + blockchain
      blockchainLatencyMs: 0
    }
  };
}

/**
 * Validates consent permissions structure and content
 * @param permissions - The permissions object to validate
 * @returns Promise<ConsentValidationResult> - Validation result for permissions
 */
export async function validateConsentPermissions(
  permissions: IConsentPermissions
): Promise<ConsentValidationResult> {
  const errors: string[] = [];

  // Validate resource types
  if (!permissions.resourceTypes || !Array.isArray(permissions.resourceTypes)) {
    errors.push('Resource types must be an array');
  } else {
    for (const type of permissions.resourceTypes) {
      if (!VALID_FHIR_RESOURCE_TYPES.includes(type)) {
        errors.push(VALIDATION_ERRORS.INVALID_RESOURCE_TYPE.replace('{type}', type));
      }
    }
  }

  // Validate access level
  if (!Object.values(ConsentAccessLevel).includes(permissions.accessLevel)) {
    errors.push(VALIDATION_ERRORS.INVALID_ACCESS_LEVEL.replace(
      '{level}', 
      permissions.accessLevel
    ));
  }

  // Validate data elements
  if (!permissions.dataElements || !Array.isArray(permissions.dataElements)) {
    errors.push('Data elements must be an array');
  }

  // Validate purpose
  if (!permissions.purpose || typeof permissions.purpose !== 'string') {
    errors.push('Purpose must be a non-empty string');
  }

  // Validate constraints
  if (permissions.constraints) {
    const constraintsValidation = validateConstraints(permissions.constraints);
    errors.push(...constraintsValidation);
  }

  return {
    isValid: errors.length === 0,
    errors,
    blockchainStatus: true,
    validationTimestamp: new Date()
  };
}

/**
 * Validates consent time period constraints
 * @param validFrom - Start date of consent validity
 * @param validTo - End date of consent validity
 * @returns Promise<ConsentValidationResult> - Validation result for time period
 */
async function validateConsentDuration(
  validFrom: Date,
  validTo: Date
): Promise<ConsentValidationResult> {
  const errors: string[] = [];
  const now = new Date();

  // Validate date objects
  if (!(validFrom instanceof Date) || !(validTo instanceof Date)) {
    errors.push('Invalid date format');
    return { isValid: false, errors, blockchainStatus: false, validationTimestamp: now };
  }

  // Validate date order
  if (validFrom >= validTo) {
    errors.push(VALIDATION_ERRORS.INVALID_DATES);
  }

  // Validate not in past
  if (validFrom < now) {
    errors.push('Valid from date cannot be in the past');
  }

  // Calculate and validate duration
  const durationDays = Math.ceil((validTo.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));
  if (durationDays < CONSENT_VALIDATION.MIN_DURATION_DAYS || 
      durationDays > CONSENT_VALIDATION.MAX_DURATION_DAYS) {
    errors.push(VALIDATION_ERRORS.INVALID_DURATION
      .replace('{min}', String(CONSENT_VALIDATION.MIN_DURATION_DAYS))
      .replace('{max}', String(CONSENT_VALIDATION.MAX_DURATION_DAYS))
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    blockchainStatus: true,
    validationTimestamp: now
  };
}

/**
 * Validates consent constraints
 * @param constraints - The constraints object to validate
 * @returns string[] - Array of validation errors
 */
function validateConstraints(constraints: any): string[] {
  const errors: string[] = [];

  if (constraints.timeRestrictions) {
    if (!Array.isArray(constraints.timeRestrictions)) {
      errors.push('Time restrictions must be an array');
    } else {
      for (const restriction of constraints.timeRestrictions) {
        if (!restriction.startTime || !restriction.endTime) {
          errors.push('Time restriction must have start and end times');
        }
      }
    }
  }

  if (constraints.ipRestrictions) {
    if (!Array.isArray(constraints.ipRestrictions)) {
      errors.push('IP restrictions must be an array');
    }
  }

  if (typeof constraints.usageLimit !== 'number' || constraints.usageLimit < 1) {
    errors.push('Usage limit must be a positive number');
  }

  return errors;
}

/**
 * Validates blockchain reference format
 * @param blockchainRef - The blockchain reference to validate
 * @returns boolean - Whether the reference is valid
 */
function validateBlockchainRef(blockchainRef: string): boolean {
  // Validate Hyperledger Fabric transaction ID format
  const fabricTxIdPattern = /^[0-9a-f]{64}$/;
  return fabricTxIdPattern.test(blockchainRef);
}