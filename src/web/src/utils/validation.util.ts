/**
 * @fileoverview Enhanced validation utilities for MyElixir healthcare data marketplace
 * Implements comprehensive form validation, FHIR resource validation, and input sanitization
 * with Material UI integration and performance monitoring
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { Resource } from '@medplum/fhirtypes'; // ^2.0.0
import { TextField } from '@mui/material'; // ^5.14.0
import { 
  USER_VALIDATION,
  FHIR_VALIDATION,
  FORM_VALIDATION_MESSAGES
} from '../constants/validation.constants';
import { 
  IFHIRValidationResult,
  IFHIRValidationError,
  IFHIRValidationWarning,
  ValidationSeverity,
  FHIRValidationErrorType
} from '../interfaces/fhir.interface';

/**
 * Interface for validation result with Material UI integration
 */
interface IValidationResult {
  isValid: boolean;
  error?: string;
  helperText?: string;
}

/**
 * Interface for FHIR validation options
 */
interface IValidationOptions {
  strictMode?: boolean;
  validateReferences?: boolean;
  maxErrors?: number;
  timeout?: number;
}

/**
 * Interface for validation performance metrics
 */
interface IValidationPerformance {
  startTime: number;
  endTime: number;
  duration: number;
  resourceCount: number;
}

/**
 * Sanitizes input string by removing potentially harmful characters
 * @param input - String to sanitize
 * @returns Sanitized string
 */
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, USER_VALIDATION.NAME_MAX_LENGTH);
};

/**
 * Enhanced email validation with Material UI error feedback
 * @param email - Email address to validate
 * @param strict - Whether to apply strict validation rules
 * @returns Validation result with Material UI compatible error message
 */
export const validateEmail = (email: string, strict = false): IValidationResult => {
  const sanitizedEmail = sanitizeInput(email);

  if (!sanitizedEmail) {
    return {
      isValid: false,
      error: FORM_VALIDATION_MESSAGES.REQUIRED_FIELD,
      helperText: 'Email address is required'
    };
  }

  const isValidFormat = USER_VALIDATION.EMAIL_PATTERN.test(sanitizedEmail);
  if (!isValidFormat) {
    return {
      isValid: false,
      error: FORM_VALIDATION_MESSAGES.INVALID_EMAIL,
      helperText: 'Please enter a valid email format'
    };
  }

  if (strict) {
    // Additional strict validation rules for healthcare context
    const [localPart, domain] = sanitizedEmail.split('@');
    if (localPart.length < 3 || domain.split('.')[0].length < 2) {
      return {
        isValid: false,
        error: 'Email does not meet security requirements',
        helperText: 'Email must have minimum length requirements'
      };
    }
  }

  return { isValid: true };
};

/**
 * Enhanced FHIR resource validation with performance monitoring
 * @param resource - FHIR resource to validate
 * @param options - Validation options
 * @returns Promise resolving to validation result with performance metrics
 */
export const validateFHIRResource = async (
  resource: Resource,
  options: IValidationOptions = {}
): Promise<IFHIRValidationResult> => {
  const performance: IValidationPerformance = {
    startTime: Date.now(),
    endTime: 0,
    duration: 0,
    resourceCount: 1
  };

  const errors: IFHIRValidationError[] = [];
  const warnings: IFHIRValidationWarning[] = [];

  try {
    // Validate resource type
    if (!FHIR_VALIDATION.RESOURCE_TYPES.includes(resource.resourceType)) {
      errors.push({
        type: FHIRValidationErrorType.Value,
        field: 'resourceType',
        message: `Invalid resource type: ${resource.resourceType}`,
        code: 'INVALID_RESOURCE_TYPE',
        severity: ValidationSeverity.Error,
        path: ['resourceType'],
        context: { validTypes: FHIR_VALIDATION.RESOURCE_TYPES }
      });
      return createValidationResult(errors, warnings, performance);
    }

    // Validate required fields
    const requiredFields = FHIR_VALIDATION.REQUIRED_FIELDS[resource.resourceType];
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!resource[field]) {
          errors.push({
            type: FHIRValidationErrorType.Required,
            field,
            message: `Missing required field: ${field}`,
            code: 'MISSING_REQUIRED_FIELD',
            severity: ValidationSeverity.Error,
            path: [field],
            context: { resourceType: resource.resourceType }
          });
        }
      }
    }

    // Validate against JSON schema
    const schema = FHIR_VALIDATION.VALIDATION_SCHEMAS[resource.resourceType];
    if (schema) {
      const zodSchema = z.object(schema);
      try {
        await zodSchema.parseAsync(resource);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          zodError.errors.forEach(err => {
            errors.push({
              type: FHIRValidationErrorType.Format,
              field: err.path.join('.'),
              message: err.message,
              code: 'SCHEMA_VALIDATION_ERROR',
              severity: ValidationSeverity.Error,
              path: err.path,
              context: { zodError: err }
            });
          });
        }
      }
    }

    // Check file size if resource contains binary data
    if (resource.data) {
      const size = new Blob([resource.data]).size;
      if (size > FHIR_VALIDATION.MAX_RESOURCE_SIZE) {
        warnings.push({
          message: FORM_VALIDATION_MESSAGES.FILE_TOO_LARGE,
          field: 'data',
          code: 'FILE_SIZE_WARNING',
          suggestion: 'Consider splitting large resources'
        });
      }
    }

    // Validate references if enabled
    if (options.validateReferences) {
      await validateReferences(resource, errors);
    }

  } catch (error) {
    errors.push({
      type: FHIRValidationErrorType.Structure,
      field: 'root',
      message: 'Unexpected validation error occurred',
      code: 'VALIDATION_ERROR',
      severity: ValidationSeverity.Error,
      path: [],
      context: { error }
    });
  }

  return createValidationResult(errors, warnings, performance);
};

/**
 * Validates references within a FHIR resource
 * @param resource - FHIR resource to validate references for
 * @param errors - Array to collect validation errors
 */
const validateReferences = async (
  resource: Resource,
  errors: IFHIRValidationError[]
): Promise<void> => {
  const references = findReferences(resource);
  for (const ref of references) {
    if (!isValidReference(ref)) {
      errors.push({
        type: FHIRValidationErrorType.Reference,
        field: ref.field,
        message: `Invalid reference: ${ref.value}`,
        code: 'INVALID_REFERENCE',
        severity: ValidationSeverity.Error,
        path: ref.path,
        context: { reference: ref }
      });
    }
  }
};

/**
 * Creates the final validation result with performance metrics
 */
const createValidationResult = (
  errors: IFHIRValidationError[],
  warnings: IFHIRValidationWarning[],
  performance: IValidationPerformance
): IFHIRValidationResult => {
  performance.endTime = Date.now();
  performance.duration = performance.endTime - performance.startTime;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    processingTime: performance.duration,
    resourceCount: performance.resourceCount
  };
};

/**
 * Helper function to find all references in a FHIR resource
 */
const findReferences = (resource: Resource): Array<{ field: string; value: string; path: string[] }> => {
  const references: Array<{ field: string; value: string; path: string[] }> = [];
  const traverse = (obj: any, path: string[] = []) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'reference' && typeof value === 'string') {
        references.push({ field: key, value, path: [...path, key] });
      } else if (typeof value === 'object') {
        traverse(value, [...path, key]);
      }
    }
  };
  
  traverse(resource);
  return references;
};

/**
 * Validates a FHIR reference string
 */
const isValidReference = (ref: { value: string }): boolean => {
  const pattern = /^(http(s)?:\/\/[^/]+\/)?[A-Za-z]+\/[A-Za-z0-9.-]{1,64}$/;
  return pattern.test(ref.value);
};