import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0
import { FHIR_RESOURCE_TYPES, FHIR_VALIDATION_RULES } from '../constants/fhir.constants';

/**
 * Type-safe enumeration of supported FHIR resource types
 * Maps directly to FHIR R4 resource types used in Medplum
 */
export type FHIRResourceType = typeof FHIR_RESOURCE_TYPES[keyof typeof FHIR_RESOURCE_TYPES];

/**
 * Comprehensive enumeration of possible FHIR validation error types
 * Used for detailed error reporting and handling
 */
export enum FHIRValidationErrorType {
  Required = 'required',
  Format = 'format',
  Value = 'value',
  Reference = 'reference',
  Cardinality = 'cardinality',
  Profile = 'profile',
  Invariant = 'invariant'
}

/**
 * Enhanced type definition for FHIR resource metadata
 * Supports visualization and tracking requirements
 */
export type FHIRMetadata = {
  versionId: string;
  lastUpdated: string;
  source: string;
  profile: string[];
  security: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  tag: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  extension: Array<{
    url: string;
    value: any;
  }>;
};

/**
 * Comprehensive type definition for FHIR search filter parameters
 * Supports advanced search and filtering capabilities
 */
export type FHIRSearchFilter = {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le' | 'contains' | 'exact' | 'missing';
  value: string | number | boolean | Date;
  chain?: string[];
  modifier?: 'missing' | 'exact' | 'contains' | 'text' | 'in' | 'not-in' | 'below' | 'above' | 'type';
  prefix?: string;
};

/**
 * Enhanced type definition for FHIR pagination parameters
 * Supports efficient data retrieval and display
 */
export type FHIRPaginationParams = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  totalCount?: boolean;
  includeArchived?: boolean;
};

/**
 * Detailed type definition for FHIR validation error information
 * Supports comprehensive error reporting and handling
 */
export type FHIRValidationError = {
  type: FHIRValidationErrorType;
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'information';
  location?: {
    line: number;
    column: number;
  };
  expression?: string;
  details?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
};

/**
 * Type guard to check if a value matches FHIRMetadata structure
 */
export const isFHIRMetadata = (value: unknown): value is FHIRMetadata => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const metadata = value as Partial<FHIRMetadata>;
  return (
    typeof metadata.versionId === 'string' &&
    typeof metadata.lastUpdated === 'string' &&
    Array.isArray(metadata.profile) &&
    Array.isArray(metadata.security) &&
    Array.isArray(metadata.tag)
  );
};

/**
 * Type guard to check if a value matches FHIRValidationError structure
 */
export const isFHIRValidationError = (value: unknown): value is FHIRValidationError => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const error = value as Partial<FHIRValidationError>;
  return (
    error.type !== undefined &&
    Object.values(FHIRValidationErrorType).includes(error.type) &&
    typeof error.field === 'string' &&
    typeof error.message === 'string' &&
    typeof error.code === 'string' &&
    ['error', 'warning', 'information'].includes(error.severity as string)
  );
};

/**
 * Type guard to check if a value matches FHIRSearchFilter structure
 */
export const isFHIRSearchFilter = (value: unknown): value is FHIRSearchFilter => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const filter = value as Partial<FHIRSearchFilter>;
  return (
    typeof filter.field === 'string' &&
    typeof filter.operator === 'string' &&
    ['eq', 'ne', 'gt', 'lt', 'ge', 'le', 'contains', 'exact', 'missing'].includes(filter.operator) &&
    (
      typeof filter.value === 'string' ||
      typeof filter.value === 'number' ||
      typeof filter.value === 'boolean' ||
      filter.value instanceof Date
    )
  );
};