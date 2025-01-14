import { isValid } from '@medplum/core'; // @medplum/core ^2.0.0
import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'; // latest
import { FHIRResource, FHIRValidationResult } from '../interfaces/fhir.interface';
import MedplumAdapter from '../fhir/adapters/medplum.adapter';
import { FHIR_VALIDATION_RULES, FHIR_ERROR_MESSAGES, FHIR_ERROR_CODES } from '../constants/fhir.constants';
import { fhirConfig } from '../config/fhir.config';

// Global constants
const FHIR_VERSION = '4.0.1';
const MAX_RESOURCE_SIZE = 5242880; // 5MB
const VALIDATION_CACHE_TTL = 3600; // 1 hour
const SENSITIVE_FIELDS = ['ssn', 'mrn', 'phone', 'email'];
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Performance monitoring decorator
 */
function performanceMetric() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = process.hrtime();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        // Log performance metric
        console.log(`Performance: ${propertyKey} took ${duration}ms`);
      }
    };
    return descriptor;
  };
}

/**
 * Cache result decorator
 */
function cacheResult() {
  const cache = new Map<string, { result: any; timestamp: number }>();
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const key = `${propertyKey}:${JSON.stringify(args)}`;
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL * 1000) {
        return cached.result;
      }
      const result = await originalMethod.apply(this, args);
      cache.set(key, { result, timestamp: Date.now() });
      return result;
    };
    return descriptor;
  };
}

/**
 * Enhanced FHIR resource validator with multi-layer validation
 * @param resource FHIR resource to validate
 * @param options Validation options
 * @returns Validation result with detailed errors and metrics
 */
@performanceMetric()
@cacheResult()
export async function validateFHIRResource(
  resource: FHIRResource,
  options: {
    strictMode?: boolean;
    validateReferences?: boolean;
    validateTerminology?: boolean;
  } = {}
): Promise<FHIRValidationResult> {
  const startTime = Date.now();
  const errors = [];
  const warnings = [];
  let validFields = 0;
  const totalFields = countResourceFields(resource);

  try {
    // Size validation
    if (JSON.stringify(resource).length > MAX_RESOURCE_SIZE) {
      errors.push({
        type: 'Structure',
        path: '$',
        message: FHIR_ERROR_MESSAGES.RESOURCE_TOO_LARGE
      });
    }

    // Basic structure validation using Medplum
    if (!isValid(resource)) {
      errors.push({
        type: 'Structure',
        path: '$',
        message: FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT
      });
    }

    // Required fields validation
    const requiredFields = FHIR_VALIDATION_RULES.REQUIRED_FIELDS[resource.resourceType] || [];
    for (const field of requiredFields) {
      if (!resource[field]) {
        errors.push({
          type: 'Required',
          path: field,
          message: `Missing required field: ${field}`
        });
      }
    }

    // Field-specific validation
    for (const [key, value] of Object.entries(resource)) {
      if (validateField(key, value, options.strictMode)) {
        validFields++;
      } else {
        errors.push({
          type: 'Value',
          path: key,
          message: `Invalid value for field: ${key}`
        });
      }
    }

    // Reference validation if enabled
    if (options.validateReferences) {
      const referenceErrors = await validateReferences(resource);
      errors.push(...referenceErrors);
    }

    // Terminology validation if enabled
    if (options.validateTerminology) {
      const terminologyErrors = await validateTerminology(resource);
      errors.push(...terminologyErrors);
    }

    // Security validation
    const securityIssues = validateSecurity(resource);
    warnings.push(...securityIssues);

  } catch (error) {
    errors.push({
      type: 'System',
      path: '$',
      message: 'System error during validation',
      value: error.message
    });
  }

  const performanceMetrics = {
    validationTime: Date.now() - startTime,
    resourceSize: JSON.stringify(resource).length
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    performanceMetrics,
    stats: {
      totalFields,
      validFields,
      errorCount: errors.length,
      warningCount: warnings.length,
      successRate: validFields / totalFields
    }
  };
}

/**
 * Transforms raw health data to FHIR R4 format with field encryption
 * @param rawData Raw health data
 * @param resourceType Target FHIR resource type
 * @param options Transform options
 * @returns Encrypted and transformed FHIR resource
 */
@performanceMetric()
export async function transformToFHIR(
  rawData: any,
  resourceType: string,
  options: {
    encryptSensitive?: boolean;
    validateOutput?: boolean;
    addMetadata?: boolean;
  } = {}
): Promise<FHIRResource> {
  try {
    // Input validation
    if (!rawData || !resourceType) {
      throw new Error(FHIR_ERROR_MESSAGES.INVALID_RESOURCE_TYPE);
    }

    // Sanitize input
    const sanitizedData = sanitizeInput(rawData);

    // Transform to FHIR structure
    const fhirResource: FHIRResource = {
      resourceType,
      id: generateSecureId(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: [`http://hl7.org/fhir/StructureDefinition/${resourceType}`]
      },
      ...mapToFHIRFields(sanitizedData, resourceType)
    };

    // Encrypt sensitive fields if enabled
    if (options.encryptSensitive) {
      encryptSensitiveFields(fhirResource);
    }

    // Add metadata if enabled
    if (options.addMetadata) {
      addResourceMetadata(fhirResource);
    }

    // Validate transformed resource if enabled
    if (options.validateOutput) {
      const validationResult = await validateFHIRResource(fhirResource);
      if (!validationResult.valid) {
        throw new Error(FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT);
      }
    }

    return fhirResource;
  } catch (error) {
    throw new Error(`FHIR transformation error: ${error.message}`);
  }
}

// Helper functions

function countResourceFields(resource: any): number {
  return Object.keys(resource).length;
}

function validateField(key: string, value: any, strictMode = false): boolean {
  // Implement field-specific validation logic
  return true; // Placeholder
}

async function validateReferences(resource: FHIRResource): Promise<any[]> {
  // Implement reference validation logic
  return []; // Placeholder
}

async function validateTerminology(resource: FHIRResource): Promise<any[]> {
  // Implement terminology validation logic
  return []; // Placeholder
}

function validateSecurity(resource: FHIRResource): any[] {
  // Implement security validation logic
  return []; // Placeholder
}

function sanitizeInput(data: any): any {
  // Implement input sanitization logic
  return data; // Placeholder
}

function generateSecureId(): string {
  return createHash('sha256')
    .update(randomBytes(32))
    .digest('hex')
    .substring(0, 32);
}

function mapToFHIRFields(data: any, resourceType: string): any {
  // Implement FHIR field mapping logic
  return data; // Placeholder
}

function encryptSensitiveFields(resource: FHIRResource): void {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const iv = randomBytes(16);

  for (const field of SENSITIVE_FIELDS) {
    if (resource[field]) {
      const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(resource[field]), 'utf8'),
        cipher.final()
      ]);
      resource[field] = {
        iv: iv.toString('hex'),
        data: encrypted.toString('hex')
      };
    }
  }
}

function addResourceMetadata(resource: FHIRResource): void {
  resource.meta = {
    ...resource.meta,
    security: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
        code: 'R',
        display: 'Restricted'
      }
    ],
    tag: [
      {
        system: 'http://myelixir.com/fhir/tags',
        code: 'validated',
        display: 'Validated Resource'
      }
    ]
  };
}