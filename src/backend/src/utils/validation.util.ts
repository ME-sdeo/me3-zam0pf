import { validate } from 'class-validator';
import { Resource } from '@medplum/fhirtypes';
import { 
  FHIRValidationResult, 
  FHIRValidationError, 
  FHIRValidationErrorType,
  FHIRValidationStats,
  FHIR_VALIDATION_THRESHOLD 
} from '../interfaces/fhir.interface';
import NodeCache from 'node-cache';

// Cache TTL set to 5 minutes for validation results
const VALIDATION_CACHE_TTL = 300;

/**
 * Cache for storing validation results to optimize performance
 * @version 5.0.0
 */
const validationCache = new NodeCache({
  stdTTL: VALIDATION_CACHE_TTL,
  checkperiod: 120
});

/**
 * Interface for validation metrics
 */
interface ValidationMetric {
  total: number;
  success: number;
  failure: number;
  successRate: number;
  lastUpdated: Date;
}

/**
 * Class for collecting and managing validation metrics
 */
export class ValidationMetricsCollector {
  private metricsStore: Map<string, ValidationMetric>;
  private static instance: ValidationMetricsCollector;

  private constructor() {
    this.metricsStore = new Map();
  }

  /**
   * Get singleton instance of ValidationMetricsCollector
   */
  public static getInstance(): ValidationMetricsCollector {
    if (!ValidationMetricsCollector.instance) {
      ValidationMetricsCollector.instance = new ValidationMetricsCollector();
    }
    return ValidationMetricsCollector.instance;
  }

  /**
   * Track validation result and update metrics
   */
  public trackValidation(validationType: string, success: boolean): void {
    const currentMetrics = this.metricsStore.get(validationType) || {
      total: 0,
      success: 0,
      failure: 0,
      successRate: 0,
      lastUpdated: new Date()
    };

    currentMetrics.total++;
    if (success) {
      currentMetrics.success++;
    } else {
      currentMetrics.failure++;
    }

    currentMetrics.successRate = currentMetrics.success / currentMetrics.total;
    currentMetrics.lastUpdated = new Date();

    this.metricsStore.set(validationType, currentMetrics);
  }

  /**
   * Get validation metrics for a specific type
   */
  public getMetrics(validationType: string): ValidationMetric | undefined {
    return this.metricsStore.get(validationType);
  }

  /**
   * Check if validation success rate meets required threshold
   */
  public checkSuccessRate(validationType: string): boolean {
    const metrics = this.metricsStore.get(validationType);
    return metrics ? metrics.successRate >= FHIR_VALIDATION_THRESHOLD : false;
  }
}

/**
 * Options for FHIR resource validation
 */
interface ValidationOptions {
  validateHIPAA?: boolean;
  validateReferences?: boolean;
  cacheResults?: boolean;
}

/**
 * Enhanced FHIR resource validator with HIPAA compliance checks
 * @param resource - FHIR resource to validate
 * @param options - Validation options
 * @returns Promise<FHIRValidationResult>
 */
export async function validateFHIRResource(
  resource: Resource,
  options: ValidationOptions = { validateHIPAA: true, validateReferences: true, cacheResults: true }
): Promise<FHIRValidationResult> {
  const cacheKey = `fhir-validation:${resource.resourceType}:${resource.id}`;
  
  // Check cache for existing validation result
  if (options.cacheResults) {
    const cachedResult = validationCache.get<FHIRValidationResult>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const errors: FHIRValidationError[] = [];
  const stats: FHIRValidationStats = {
    totalFields: 0,
    validFields: 0,
    errorCount: 0,
    warningCount: 0,
    successRate: 0
  };

  // Validate resource type and required fields
  if (!resource.resourceType) {
    errors.push({
      type: FHIRValidationErrorType.Required,
      path: 'resourceType',
      message: 'Resource type is required'
    });
  }

  // Validate HIPAA compliance if enabled
  if (options.validateHIPAA) {
    const hipaaErrors = validateHIPAACompliance(resource);
    errors.push(...hipaaErrors);
  }

  // Validate resource structure and data types
  const structuralErrors = await validateResourceStructure(resource);
  errors.push(...structuralErrors);

  // Calculate validation statistics
  stats.totalFields = countResourceFields(resource);
  stats.errorCount = errors.length;
  stats.validFields = stats.totalFields - stats.errorCount;
  stats.successRate = stats.validFields / stats.totalFields;

  const validationResult: FHIRValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings: [],
    stats
  };

  // Cache validation result if enabled
  if (options.cacheResults) {
    validationCache.set(cacheKey, validationResult);
  }

  // Track validation metrics
  ValidationMetricsCollector.getInstance().trackValidation(
    resource.resourceType,
    validationResult.valid
  );

  return validationResult;
}

/**
 * Validate HIPAA compliance for PHI fields
 */
function validateHIPAACompliance(resource: Resource): FHIRValidationError[] {
  const errors: FHIRValidationError[] = [];
  
  // Check for required HIPAA identifiers
  const requiredHIPAAFields = ['id', 'meta.security'];
  for (const field of requiredHIPAAFields) {
    if (!getNestedValue(resource, field)) {
      errors.push({
        type: FHIRValidationErrorType.Required,
        path: field,
        message: `HIPAA compliance requires ${field}`
      });
    }
  }

  // Validate PHI field formats
  if (resource.resourceType === 'Patient') {
    const phiFields = ['identifier', 'name', 'birthDate', 'address'];
    for (const field of phiFields) {
      const value = getNestedValue(resource, field);
      if (value && !validatePHIFormat(field, value)) {
        errors.push({
          type: FHIRValidationErrorType.Format,
          path: field,
          message: `Invalid PHI format for ${field}`
        });
      }
    }
  }

  return errors;
}

/**
 * Validate resource structure and data types
 */
async function validateResourceStructure(resource: Resource): Promise<FHIRValidationError[]> {
  const errors: FHIRValidationError[] = [];
  const validationErrors = await validate(resource);

  for (const error of validationErrors) {
    errors.push({
      type: FHIRValidationErrorType.Structure,
      path: error.property,
      message: Object.values(error.constraints || {}).join(', ')
    });
  }

  return errors;
}

/**
 * Validate PHI field format
 */
function validatePHIFormat(field: string, value: any): boolean {
  // PHI format validation rules
  const formatRules: { [key: string]: RegExp } = {
    identifier: /^\w{1,64}$/,
    name: /^[\w\s]{1,100}$/,
    birthDate: /^\d{4}-\d{2}-\d{2}$/,
    address: /^[\w\s,.-]{1,200}$/
  };

  return formatRules[field]?.test(String(value)) ?? true;
}

/**
 * Get nested object value using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Count total fields in a resource
 */
function countResourceFields(resource: any): number {
  let count = 0;
  for (const key in resource) {
    if (typeof resource[key] === 'object') {
      count += countResourceFields(resource[key]);
    } else {
      count++;
    }
  }
  return count;
}