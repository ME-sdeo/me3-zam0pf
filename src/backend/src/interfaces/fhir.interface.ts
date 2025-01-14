// @medplum/fhirtypes v2.0.0 - Core FHIR resource type definitions
import { Resource } from '@medplum/fhirtypes';

/**
 * FHIR version constant for R4 compatibility
 */
export const FHIR_VERSION = '4.0.1';

/**
 * Required validation success rate threshold (99.9%)
 */
export const FHIR_VALIDATION_THRESHOLD = 0.999;

/**
 * Enhanced enum of possible FHIR validation error types
 */
export enum FHIRValidationErrorType {
  Required = 'Required',
  Format = 'Format',
  Value = 'Value',
  Reference = 'Reference',
  Cardinality = 'Cardinality',
  Pattern = 'Pattern',
  Invariant = 'Invariant',
  CodeSystem = 'CodeSystem',
  Extension = 'Extension',
  Structure = 'Structure'
}

/**
 * Enum for FHIR search operators
 */
export enum FHIRSearchOperator {
  Equals = 'eq',
  NotEquals = 'ne',
  GreaterThan = 'gt',
  LessThan = 'lt',
  GreaterThanOrEquals = 'ge',
  LessThanOrEquals = 'le',
  Contains = 'contains',
  Exact = 'exact',
  Missing = 'missing'
}

/**
 * Enum for FHIR search modifiers
 */
export enum FHIRSearchModifier {
  Type = 'type',
  Missing = 'missing',
  Exact = 'exact',
  Contains = 'contains',
  Text = 'text',
  Not = 'not',
  Above = 'above',
  Below = 'below',
  In = 'in',
  NotIn = 'not-in'
}

/**
 * Interface for FHIR coding system entries
 */
export interface FHIRCoding {
  system?: string;
  version?: string;
  code: string;
  display?: string;
  userSelected?: boolean;
}

/**
 * Interface for FHIR extensions
 */
export interface FHIRExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDateTime?: string;
  valueQuantity?: FHIRQuantity;
  valueReference?: FHIRReference;
}

/**
 * Interface for FHIR quantity values
 */
export interface FHIRQuantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
}

/**
 * Interface for FHIR references
 */
export interface FHIRReference {
  reference: string;
  type?: string;
  display?: string;
}

/**
 * Interface for FHIR resource metadata
 */
export interface FHIRResourceMeta {
  versionId: string;
  lastUpdated: string;
  source?: string;
  profile?: string[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

/**
 * Enhanced base interface for all FHIR resources
 */
export interface FHIRResource extends Resource {
  resourceType: string;
  id: string;
  meta: FHIRResourceMeta;
  extension?: FHIRExtension[];
}

/**
 * Interface for FHIR validation errors
 */
export interface FHIRValidationError {
  type: FHIRValidationErrorType;
  path: string;
  message: string;
  value?: any;
  expected?: any;
}

/**
 * Interface for FHIR validation warnings
 */
export interface FHIRValidationWarning {
  path: string;
  message: string;
  details?: any;
}

/**
 * Interface for validation statistics
 */
export interface FHIRValidationStats {
  totalFields: number;
  validFields: number;
  errorCount: number;
  warningCount: number;
  successRate: number;
}

/**
 * Comprehensive interface for FHIR validation results
 */
export interface FHIRValidationResult {
  valid: boolean;
  errors: FHIRValidationError[];
  warnings: FHIRValidationWarning[];
  stats: FHIRValidationStats;
}

/**
 * Type for FHIR search filter parameters
 */
export type FHIRSearchFilter = {
  field: string;
  operator: FHIRSearchOperator;
  value: any;
  chain?: string[];
  modifier?: FHIRSearchModifier;
};

/**
 * Interface for FHIR search include parameters
 */
export interface FHIRSearchInclude {
  resourceType: string;
  searchParam: string;
  recursive?: boolean;
}

/**
 * Interface for FHIR search sort parameters
 */
export interface FHIRSearchSort {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Interface for FHIR pagination parameters
 */
export interface FHIRPaginationParams {
  _count?: number;
  _offset?: number;
  _page?: number;
}

/**
 * Enhanced interface for FHIR search parameters
 */
export interface FHIRSearchParams {
  resourceType: string;
  filters: FHIRSearchFilter[];
  pagination?: FHIRPaginationParams;
  includes?: FHIRSearchInclude[];
  sort?: FHIRSearchSort[];
}