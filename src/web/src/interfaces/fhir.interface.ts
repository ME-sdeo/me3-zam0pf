// @medplum/fhirtypes ^2.0.0
import { Resource } from '@medplum/fhirtypes';
import { 
  FHIR_RESOURCE_TYPES, 
  FHIR_VALIDATION_RULES 
} from '../constants/fhir.constants';

/**
 * Base interface for all FHIR resources in the frontend
 * Extends Medplum's Resource type with additional MyElixir-specific requirements
 */
export interface IFHIRResource extends Resource {
  resourceType: string;
  id: string;
  meta: {
    versionId: string;
    lastUpdated: string;
    source: string;
    profile: string[];
    security: IFHIRCoding[];
    tag: IFHIRCoding[];
  };
}

/**
 * Interface for standardized FHIR coding entries
 */
export interface IFHIRCoding {
  system: string;
  code: string;
  display?: string;
  version?: string;
  userSelected?: boolean;
}

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
 * Enum for validation message severity levels
 */
export enum ValidationSeverity {
  Error = 'Error',
  Warning = 'Warning',
  Information = 'Information'
}

/**
 * Enhanced interface for FHIR validation error details
 */
export interface IFHIRValidationError {
  type: FHIRValidationErrorType;
  field: string;
  message: string;
  code: string;
  severity: ValidationSeverity;
  path: string[];
  context: Record<string, unknown>;
  suggestion?: string;
}

/**
 * Interface for FHIR validation warnings
 */
export interface IFHIRValidationWarning {
  message: string;
  field?: string;
  code?: string;
  path?: string[];
  suggestion?: string;
}

/**
 * Interface for FHIR resource validation results with enhanced error tracking
 */
export interface IFHIRValidationResult {
  valid: boolean;
  errors: IFHIRValidationError[];
  warnings: IFHIRValidationWarning[];
  processingTime: number;
  resourceCount: number;
}

/**
 * Interface for FHIR search filter parameters
 */
export interface IFHIRSearchFilter {
  field: string;
  operator: FHIRSearchOperator;
  value: string | number | boolean | Date;
  modifier?: FHIRSearchModifier;
}

/**
 * Enum for supported FHIR search operators
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
  In = 'in',
  NotIn = 'not-in',
  Below = 'below',
  Above = 'above'
}

/**
 * Interface for FHIR pagination parameters
 */
export interface IFHIRPaginationParams {
  _count?: number;
  _offset?: number;
  _page?: number;
  _total?: 'none' | 'estimate' | 'accurate';
}

/**
 * Interface for FHIR sort parameters
 */
export interface IFHIRSortParam {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Enum for FHIR summary types
 */
export enum FHIRSummaryType {
  True = 'true',
  False = 'false',
  Text = 'text',
  Data = 'data',
  Count = 'count'
}

/**
 * Enhanced interface for FHIR resource search parameters
 */
export interface IFHIRSearchParams {
  resourceType: string;
  filters: IFHIRSearchFilter[];
  pagination: IFHIRPaginationParams;
  includes: string[];
  sort: IFHIRSortParam[];
  summary: FHIRSummaryType;
}

/**
 * Type guard to check if a value is a valid IFHIRResource
 */
export function isIFHIRResource(value: unknown): value is IFHIRResource {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const resource = value as Partial<IFHIRResource>;
  return (
    typeof resource.resourceType === 'string' &&
    Object.values(FHIR_RESOURCE_TYPES).includes(resource.resourceType as FHIR_RESOURCE_TYPES) &&
    typeof resource.id === 'string' &&
    resource.meta !== undefined
  );
}

/**
 * Type guard to check if a value is a valid IFHIRValidationResult
 */
export function isIFHIRValidationResult(value: unknown): value is IFHIRValidationResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<IFHIRValidationResult>;
  return (
    typeof result.valid === 'boolean' &&
    Array.isArray(result.errors) &&
    Array.isArray(result.warnings) &&
    typeof result.processingTime === 'number' &&
    typeof result.resourceCount === 'number'
  );
}