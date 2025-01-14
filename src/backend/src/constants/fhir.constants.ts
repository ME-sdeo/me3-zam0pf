/**
 * @fileoverview Core FHIR (Fast Healthcare Interoperability Resources) constants used throughout 
 * the MyElixir platform for FHIR R4 resource management, validation rules, error messages, 
 * and configuration defaults.
 * @version 1.0.0
 */

// @medplum/fhirtypes v2.0.0
import { ResourceType } from '@medplum/fhirtypes';

/**
 * FHIR specification version used in the platform
 */
export const FHIR_VERSION = '4.0.1';

/**
 * Supported FHIR resource types in the platform
 */
export enum FHIR_RESOURCE_TYPES {
  PATIENT = 'Patient',
  OBSERVATION = 'Observation',
  CONDITION = 'Condition',
  PROCEDURE = 'Procedure',
  MEDICATION = 'Medication'
}

/**
 * Validation rules for FHIR resources
 */
export const FHIR_VALIDATION_RULES = {
  REQUIRED_FIELDS: {
    ALL: ['resourceType', 'id'] as ResourceType[],
    Patient: ['name', 'gender', 'birthDate'],
    Observation: ['status', 'code', 'subject'],
    Condition: ['code', 'subject'],
    Procedure: ['status', 'code', 'subject'],
    Medication: ['code']
  },
  MAX_FIELD_LENGTH: 1048576, // 1MB max field size
  MAX_ARRAY_LENGTH: 1000, // Maximum items in arrays
  STRING_MAX_LENGTH: 1000000 // 1MB max string length
} as const;

/**
 * Error codes for FHIR operations
 */
export const FHIR_ERROR_CODES = {
  INVALID_RESOURCE: 'FHIR001',
  VALIDATION_FAILED: 'FHIR002',
  RESOURCE_NOT_FOUND: 'FHIR003',
  UNAUTHORIZED_ACCESS: 'FHIR004',
  SERVER_ERROR: 'FHIR005'
} as const;

/**
 * Error messages for FHIR operations
 */
export const FHIR_ERROR_MESSAGES = {
  INVALID_RESOURCE_TYPE: 'Invalid FHIR resource type provided',
  MISSING_REQUIRED_FIELDS: 'Required fields are missing in the FHIR resource',
  RESOURCE_TOO_LARGE: 'FHIR resource exceeds maximum size limit',
  INVALID_FHIR_FORMAT: 'Resource does not conform to FHIR R4 specification',
  RESOURCE_NOT_FOUND: 'Requested FHIR resource not found',
  UNAUTHORIZED: 'Unauthorized access to FHIR resource'
} as const;

/**
 * Search operators for FHIR queries
 */
export const FHIR_SEARCH_OPERATORS = {
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  GREATER_THAN_OR_EQUALS: 'ge',
  LESS_THAN_OR_EQUALS: 'le',
  CONTAINS: 'contains',
  EXACT: 'exact'
} as const;