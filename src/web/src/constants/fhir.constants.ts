import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0

/**
 * FHIR specification version used throughout the application
 * Currently using R4 (4.0.1) for Medplum compatibility
 */
export const FHIR_VERSION = 'R4';

/**
 * Enumeration of supported FHIR resource types
 * Used for type safety and validation throughout the application
 */
export enum FHIR_RESOURCE_TYPES {
  PATIENT = 'Patient',
  OBSERVATION = 'Observation',
  CONDITION = 'Condition',
  DIAGNOSTIC_REPORT = 'DiagnosticReport',
  MEDICATION = 'Medication',
  MEDICATION_REQUEST = 'MedicationRequest',
  IMMUNIZATION = 'Immunization',
  PROCEDURE = 'Procedure'
}

/**
 * Comprehensive validation rules to ensure 99.9% FHIR validation success rate
 * Implements strict validation according to FHIR R4 specification
 */
export const FHIR_VALIDATION_RULES = {
  /**
   * Fields that must be present in all FHIR resources
   */
  REQUIRED_FIELDS: ['resourceType', 'id'] as const,

  /**
   * Maximum length for any single field in a FHIR resource
   * Set to 64000 to accommodate large text fields while preventing DOS attacks
   */
  MAX_FIELD_LENGTH: 64000,

  /**
   * Supported FHIR data formats for import/export
   */
  SUPPORTED_FORMATS: ['json', 'xml'] as const,

  /**
   * Timeout for FHIR validation operations in milliseconds
   * Set to 30 seconds to balance thoroughness with user experience
   */
  VALIDATION_TIMEOUT: 30000,

  /**
   * Maximum number of validation errors to collect before stopping
   * Prevents memory issues with malformed resources while providing comprehensive feedback
   */
  MAX_VALIDATION_ERRORS: 100,

  /**
   * Whether to enforce strict FHIR compliance
   * Set to true to ensure 99.9% validation success rate requirement
   */
  STRICT_MODE: true
} as const;

/**
 * FHIR MIME types for content negotiation
 * Used for API requests and responses
 */
export const FHIR_MIME_TYPES = {
  /**
   * FHIR JSON content type as per specification
   */
  JSON: 'application/fhir+json',

  /**
   * FHIR XML content type as per specification
   */
  XML: 'application/fhir+xml'
} as const;

/**
 * Type guard to check if a value is a valid FHIR resource type
 * @param value - Value to check
 * @returns True if value is a valid FHIR resource type
 */
export const isFhirResourceType = (value: string): value is FHIR_RESOURCE_TYPES => {
  return Object.values(FHIR_RESOURCE_TYPES).includes(value as FHIR_RESOURCE_TYPES);
};

/**
 * Type guard to check if a value is a valid FHIR resource
 * @param value - Value to check
 * @returns True if value is a valid FHIR resource
 */
export const isFhirResource = (value: unknown): value is Resource => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const resource = value as Partial<Resource>;
  return (
    typeof resource.resourceType === 'string' &&
    isFhirResourceType(resource.resourceType) &&
    typeof resource.id === 'string'
  );
};