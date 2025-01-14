import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0
import { isResource, validateResource } from '@medplum/core'; // @medplum/core ^2.0.0
import { 
  IFHIRResource,
  IFHIRValidationResult,
  IFHIRValidationError,
  IFHIRValidationWarning,
  FHIRValidationErrorType,
  ValidationSeverity
} from '../interfaces/fhir.interface';
import { 
  FHIR_VALIDATION_RULES,
  FHIR_MIME_TYPES,
  FHIR_RESOURCE_TYPES,
  isFhirResourceType
} from '../constants/fhir.constants';

// Global configuration constants
const VALIDATION_TIMEOUT_MS = 30000;
const MAX_VALIDATION_ERRORS = 100;

/**
 * Options for FHIR resource validation
 */
interface ValidationOptions {
  timeoutMs?: number;
  maxErrors?: number;
  validateProfile?: boolean;
  strictMode?: boolean;
}

/**
 * Options for FHIR resource formatting
 */
interface FormatOptions {
  sortArrays?: boolean;
  removeEmpty?: boolean;
  validateMimeType?: boolean;
  mimeType?: string;
}

/**
 * Options for FHIR resource transformation
 */
interface TransformOptions {
  validateSource?: boolean;
  validateTarget?: boolean;
  preserveMetadata?: boolean;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  timeoutMs: VALIDATION_TIMEOUT_MS,
  maxErrors: MAX_VALIDATION_ERRORS,
  validateProfile: true,
  strictMode: true
};

/**
 * Default format options
 */
const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  sortArrays: true,
  removeEmpty: true,
  validateMimeType: true,
  mimeType: FHIR_MIME_TYPES.JSON
};

/**
 * Validates a FHIR resource with enhanced error handling and timeout management
 * @param resource - The FHIR resource to validate
 * @param options - Validation options
 * @returns Promise resolving to validation result
 */
export async function validateFHIRResource(
  resource: IFHIRResource,
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
): Promise<IFHIRValidationResult> {
  const startTime = Date.now();
  const errors: IFHIRValidationError[] = [];
  const warnings: IFHIRValidationWarning[] = [];

  try {
    // Basic resource validation
    if (!isResource(resource)) {
      errors.push({
        type: FHIRValidationErrorType.Structure,
        field: 'root',
        message: 'Invalid FHIR resource structure',
        code: 'INVALID_STRUCTURE',
        severity: ValidationSeverity.Error,
        path: [],
        context: {}
      });
      return {
        valid: false,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
        resourceCount: 1
      };
    }

    // Resource type validation
    if (!isFhirResourceType(resource.resourceType)) {
      errors.push({
        type: FHIRValidationErrorType.Value,
        field: 'resourceType',
        message: `Invalid resource type: ${resource.resourceType}`,
        code: 'INVALID_RESOURCE_TYPE',
        severity: ValidationSeverity.Error,
        path: ['resourceType'],
        context: { value: resource.resourceType }
      });
    }

    // Required fields validation
    for (const field of FHIR_VALIDATION_RULES.REQUIRED_FIELDS) {
      if (!resource[field]) {
        errors.push({
          type: FHIRValidationErrorType.Required,
          field,
          message: `Missing required field: ${field}`,
          code: 'MISSING_REQUIRED_FIELD',
          severity: ValidationSeverity.Error,
          path: [field],
          context: {}
        });
      }
    }

    // Field length validation
    const validateFieldLength = (obj: any, path: string[] = []): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > FHIR_VALIDATION_RULES.MAX_FIELD_LENGTH) {
          errors.push({
            type: FHIRValidationErrorType.Value,
            field: key,
            message: `Field exceeds maximum length of ${FHIR_VALIDATION_RULES.MAX_FIELD_LENGTH}`,
            code: 'FIELD_TOO_LONG',
            severity: ValidationSeverity.Error,
            path: [...path, key],
            context: { maxLength: FHIR_VALIDATION_RULES.MAX_FIELD_LENGTH }
          });
        } else if (typeof value === 'object' && value !== null) {
          validateFieldLength(value, [...path, key]);
        }
      }
    };
    validateFieldLength(resource);

    // Profile validation if enabled
    if (options.validateProfile && resource.meta?.profile?.length) {
      const profileValidation = await validateResource(resource);
      if (!profileValidation.success) {
        profileValidation.issues?.forEach(issue => {
          errors.push({
            type: FHIRValidationErrorType.Pattern,
            field: issue.expression?.[0] || 'unknown',
            message: issue.diagnostics || 'Profile validation failed',
            code: issue.code || 'PROFILE_VALIDATION_ERROR',
            severity: ValidationSeverity.Error,
            path: issue.expression || [],
            context: { profile: resource.meta.profile }
          });
        });
      }
    }

    // Check for timeout
    if (Date.now() - startTime > (options.timeoutMs || VALIDATION_TIMEOUT_MS)) {
      throw new Error('Validation timeout exceeded');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      processingTime: Date.now() - startTime,
      resourceCount: 1
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        type: FHIRValidationErrorType.Structure,
        field: 'root',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        code: 'VALIDATION_ERROR',
        severity: ValidationSeverity.Error,
        path: [],
        context: { error }
      }],
      warnings,
      processingTime: Date.now() - startTime,
      resourceCount: 1
    };
  }
}

/**
 * Formats a FHIR resource with consistent output and MIME type validation
 * @param resource - The FHIR resource to format
 * @param options - Format options
 * @returns Formatted FHIR resource
 */
export function formatFHIRResource(
  resource: IFHIRResource,
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS
): IFHIRResource {
  // Validate MIME type if enabled
  if (options.validateMimeType && options.mimeType) {
    if (!Object.values(FHIR_MIME_TYPES).includes(options.mimeType)) {
      throw new Error(`Invalid MIME type: ${options.mimeType}`);
    }
  }

  // Deep clone the resource to avoid mutations
  const formatted = JSON.parse(JSON.stringify(resource));

  // Remove empty values if enabled
  if (options.removeEmpty) {
    const removeEmpty = (obj: any): any => {
      Object.entries(obj).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          delete obj[key];
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            delete obj[key];
          } else {
            obj[key] = value.map(item => 
              typeof item === 'object' ? removeEmpty(item) : item
            ).filter(item => item !== null);
          }
        } else if (typeof value === 'object') {
          obj[key] = removeEmpty(value);
          if (Object.keys(obj[key]).length === 0) {
            delete obj[key];
          }
        }
      });
      return obj;
    };
    removeEmpty(formatted);
  }

  // Sort arrays if enabled
  if (options.sortArrays) {
    const sortArrays = (obj: any): any => {
      Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          obj[key] = value
            .map(item => typeof item === 'object' ? sortArrays(item) : item)
            .sort((a, b) => {
              if (typeof a === 'string' && typeof b === 'string') {
                return a.localeCompare(b);
              }
              return 0;
            });
        } else if (typeof value === 'object' && value !== null) {
          obj[key] = sortArrays(value);
        }
      });
      return obj;
    };
    sortArrays(formatted);
  }

  return formatted;
}

/**
 * Transforms a FHIR resource to a target profile with validation
 * @param resource - The FHIR resource to transform
 * @param targetProfile - Target profile URL
 * @param options - Transform options
 * @returns Promise resolving to transformed FHIR resource
 */
export async function transformFHIRResource(
  resource: IFHIRResource,
  targetProfile: string,
  options: TransformOptions = { validateSource: true, validateTarget: true }
): Promise<IFHIRResource> {
  // Validate source resource if enabled
  if (options.validateSource) {
    const validation = await validateFHIRResource(resource);
    if (!validation.valid) {
      throw new Error('Source resource validation failed');
    }
  }

  // Create transformed resource
  const transformed: IFHIRResource = {
    ...resource,
    meta: {
      ...resource.meta,
      profile: [targetProfile]
    }
  };

  // Preserve metadata if specified
  if (options.preserveMetadata && resource.meta) {
    transformed.meta = {
      ...resource.meta,
      profile: [targetProfile, ...(resource.meta.profile || [])]
    };
  }

  // Validate transformed resource if enabled
  if (options.validateTarget) {
    const validation = await validateFHIRResource(transformed);
    if (!validation.valid) {
      throw new Error('Transformed resource validation failed');
    }
  }

  return transformed;
}