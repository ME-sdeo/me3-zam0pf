// @medplum/fhirtypes v2.0.0
import { Resource } from '@medplum/fhirtypes';
import { FHIRResource } from '../interfaces/fhir.interface';

/**
 * Supported FHIR resource types in the MyElixir platform
 */
export enum FHIRResourceType {
  Patient = 'Patient',
  Observation = 'Observation',
  Condition = 'Condition',
  Medication = 'Medication',
  Procedure = 'Procedure',
  DiagnosticReport = 'DiagnosticReport',
  Immunization = 'Immunization',
  AllergyIntolerance = 'AllergyIntolerance'
}

/**
 * FHIR validation error types for accurate error reporting
 */
export enum FHIRValidationErrorType {
  Required = 'Required',
  Format = 'Format',
  Value = 'Value',
  Reference = 'Reference',
  Cardinality = 'Cardinality',
  Invariant = 'Invariant',
  CodeSystem = 'CodeSystem',
  Profile = 'Profile'
}

/**
 * Search operators for FHIR query operations
 */
export enum SearchOperator {
  eq = 'eq', // equals
  ne = 'ne', // not equals
  gt = 'gt', // greater than
  lt = 'lt', // less than
  ge = 'ge', // greater than or equals
  le = 'le', // less than or equals
  sa = 'sa', // starts after
  eb = 'eb', // ends before
  ap = 'ap'  // approximately
}

/**
 * Search modifiers for FHIR query refinement
 */
export enum SearchModifier {
  missing = 'missing',
  exact = 'exact',
  contains = 'contains',
  text = 'text',
  in = 'in',
  'not-in' = 'not-in',
  below = 'below',
  above = 'above',
  type = 'type'
}

/**
 * Type definition for FHIR search filter parameters
 */
export type FHIRSearchFilter = {
  field: string;
  operator: SearchOperator;
  value: any;
  modifier?: SearchModifier;
  chain?: string[];
};

/**
 * Type definition for sort parameters in FHIR queries
 */
export type SortParams = {
  field: string;
  direction: 'asc' | 'desc';
};

/**
 * Type definition for FHIR pagination parameters
 */
export type FHIRPaginationParams = {
  page: number;
  pageSize: number;
  cursor?: string;
  sort?: SortParams[];
};

/**
 * Type definition for FHIR resource metadata
 */
export type FHIRMetadata = {
  versionId: string;
  lastUpdated: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
  extension?: Extension[];
};

/**
 * Type definition for FHIR coding
 */
export type Coding = {
  system?: string;
  version?: string;
  code: string;
  display?: string;
  userSelected?: boolean;
};

/**
 * Type definition for FHIR extensions
 */
export type Extension = {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueDateTime?: string;
};

// Global constants for FHIR validation and processing
export const FHIR_VERSION = '4.0.1';
export const MAX_FIELD_LENGTH = 1000000;
export const MAX_ARRAY_LENGTH = 1000;
export const DEFAULT_PAGE_SIZE = 20;

// Supported resource types in the platform
export const SUPPORTED_RESOURCE_TYPES = [
  FHIRResourceType.Patient,
  FHIRResourceType.Observation,
  FHIRResourceType.Condition,
  FHIRResourceType.Medication,
  FHIRResourceType.Procedure,
  FHIRResourceType.DiagnosticReport,
  FHIRResourceType.Immunization,
  FHIRResourceType.AllergyIntolerance
] as const;

/**
 * Type guard to check if a string is a valid FHIR resource type
 */
export function isValidResourceType(type: string): type is FHIRResourceType {
  return Object.values(FHIRResourceType).includes(type as FHIRResourceType);
}

/**
 * Type guard to check if a value is a valid FHIR resource
 */
export function isFHIRResource(value: any): value is FHIRResource {
  return (
    value &&
    typeof value === 'object' &&
    'resourceType' in value &&
    'id' in value &&
    isValidResourceType(value.resourceType)
  );
}