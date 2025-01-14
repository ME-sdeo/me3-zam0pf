import { injectable } from 'inversify';
import { isValid, sanitizeResource } from '@medplum/core'; // @medplum/core ^2.0.0
import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0
import { FHIRResource, FHIRValidationResult, FHIRValidationError, FHIRValidationWarning } from '../../interfaces/fhir.interface';
import MedplumAdapter from '../adapters/medplum.adapter';
import { FHIR_VALIDATION_RULES, FHIR_ERROR_MESSAGES, FHIR_VERSION } from '../../constants/fhir.constants';
import { fhirConfig } from '../../config/fhir.config';

// Constants for validation configuration
const MAX_RESOURCE_SIZE = 5242880; // 5MB
const SUPPORTED_FHIR_VERSIONS = ['4.0.1'];
const DEFAULT_VALIDATION_TIMEOUT = 5000;
const MAX_BATCH_SIZE = 100;

@injectable()
export class FHIRResourceValidator {
  private readonly validationCache: Map<string, FHIRValidationResult>;
  private readonly validationTimeout: number;

  constructor(
    private readonly medplumAdapter: MedplumAdapter,
    config: typeof fhirConfig.validation = fhirConfig.validation
  ) {
    this.validationCache = new Map();
    this.validationTimeout = config.timeout || DEFAULT_VALIDATION_TIMEOUT;
  }

  /**
   * Validates a single FHIR resource with comprehensive checks
   * @param resource FHIR resource to validate
   * @param options Optional validation configuration
   * @returns Promise<FHIRValidationResult>
   */
  public async validateResource(
    resource: FHIRResource,
    options: { strictMode?: boolean; validateMetadata?: boolean } = {}
  ): Promise<FHIRValidationResult> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(resource);
      const cachedResult = this.validationCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const errors: FHIRValidationError[] = [];
      const warnings: FHIRValidationWarning[] = [];

      // Basic validation checks
      if (!this.validateBasicRequirements(resource, errors)) {
        return this.createValidationResult(errors, warnings);
      }

      // Size validation
      if (!this.validateResourceSize(resource, errors)) {
        return this.createValidationResult(errors, warnings);
      }

      // Sanitize resource
      const sanitizedResource = sanitizeResource(resource);

      // Structural validation
      if (!this.validateStructure(sanitizedResource, errors, warnings)) {
        return this.createValidationResult(errors, warnings);
      }

      // Required fields validation
      this.validateRequiredFields(sanitizedResource, errors);

      // Version compatibility check
      this.validateFHIRVersion(sanitizedResource, warnings);

      // Metadata validation if requested
      if (options.validateMetadata) {
        this.validateMetadata(sanitizedResource, errors, warnings);
      }

      // Medplum core validation
      const medplumValidation = await this.medplumAdapter.validateResource(sanitizedResource);
      if (!medplumValidation.valid) {
        errors.push(...medplumValidation.errors);
      }

      // Create final validation result
      const result = this.createValidationResult(errors, warnings);

      // Cache the result
      this.validationCache.set(cacheKey, result);

      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [{
          type: 'Structure',
          path: '',
          message: 'Validation process failed: ' + error.message
        }],
        warnings: [],
        stats: {
          totalFields: 0,
          validFields: 0,
          errorCount: 1,
          warningCount: 0,
          successRate: 0
        }
      };
    }
  }

  /**
   * Validates a batch of FHIR resources efficiently
   * @param resources Array of FHIR resources to validate
   * @param options Optional validation configuration
   * @returns Promise with batch validation results
   */
  public async validateBatch(
    resources: FHIRResource[],
    options: { strictMode?: boolean; validateMetadata?: boolean } = {}
  ): Promise<{ valid: boolean; results: FHIRValidationResult[] }> {
    if (!Array.isArray(resources) || resources.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size must not exceed ${MAX_BATCH_SIZE} resources`);
    }

    const results = await Promise.all(
      resources.map(resource => this.validateResource(resource, options))
    );

    return {
      valid: results.every(result => result.valid),
      results
    };
  }

  private validateBasicRequirements(
    resource: FHIRResource,
    errors: FHIRValidationError[]
  ): boolean {
    if (!resource || typeof resource !== 'object') {
      errors.push({
        type: 'Structure',
        path: '',
        message: FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT
      });
      return false;
    }

    if (!resource.resourceType) {
      errors.push({
        type: 'Required',
        path: 'resourceType',
        message: FHIR_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
      });
      return false;
    }

    return true;
  }

  private validateResourceSize(
    resource: FHIRResource,
    errors: FHIRValidationError[]
  ): boolean {
    const size = new TextEncoder().encode(JSON.stringify(resource)).length;
    if (size > MAX_RESOURCE_SIZE) {
      errors.push({
        type: 'Value',
        path: '',
        message: FHIR_ERROR_MESSAGES.RESOURCE_TOO_LARGE
      });
      return false;
    }
    return true;
  }

  private validateStructure(
    resource: FHIRResource,
    errors: FHIRValidationError[],
    warnings: FHIRValidationWarning[]
  ): boolean {
    // Validate against core FHIR structure
    if (!isValid(resource as Resource)) {
      errors.push({
        type: 'Structure',
        path: '',
        message: FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT
      });
      return false;
    }

    return true;
  }

  private validateRequiredFields(
    resource: FHIRResource,
    errors: FHIRValidationError[]
  ): void {
    const requiredFields = [
      ...FHIR_VALIDATION_RULES.REQUIRED_FIELDS.ALL,
      ...(FHIR_VALIDATION_RULES.REQUIRED_FIELDS[resource.resourceType] || [])
    ];

    for (const field of requiredFields) {
      if (!resource[field]) {
        errors.push({
          type: 'Required',
          path: field,
          message: `Required field '${field}' is missing`
        });
      }
    }
  }

  private validateFHIRVersion(
    resource: FHIRResource,
    warnings: FHIRValidationWarning[]
  ): void {
    if (!SUPPORTED_FHIR_VERSIONS.includes(FHIR_VERSION)) {
      warnings.push({
        path: 'meta.version',
        message: `FHIR version ${FHIR_VERSION} may not be fully supported`
      });
    }
  }

  private validateMetadata(
    resource: FHIRResource,
    errors: FHIRValidationError[],
    warnings: FHIRValidationWarning[]
  ): void {
    if (!resource.meta) {
      warnings.push({
        path: 'meta',
        message: 'Resource metadata is missing'
      });
      return;
    }

    if (!resource.meta.versionId) {
      warnings.push({
        path: 'meta.versionId',
        message: 'Resource version ID is missing'
      });
    }

    if (!resource.meta.lastUpdated) {
      warnings.push({
        path: 'meta.lastUpdated',
        message: 'Resource last updated timestamp is missing'
      });
    }
  }

  private createValidationResult(
    errors: FHIRValidationError[],
    warnings: FHIRValidationWarning[]
  ): FHIRValidationResult {
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalFields: 0, // Calculated based on resource
        validFields: 0, // Calculated based on validation
        errorCount: errors.length,
        warningCount: warnings.length,
        successRate: errors.length === 0 ? 1 : 0
      }
    };
  }

  private getCacheKey(resource: FHIRResource): string {
    return `${resource.resourceType}:${resource.id}:${JSON.stringify(resource)}`;
  }
}

export default FHIRResourceValidator;