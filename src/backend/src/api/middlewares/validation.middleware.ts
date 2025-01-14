import { Request, Response, NextFunction } from 'express'; // version: 4.18.x
import { ValidationError } from 'class-validator'; // version: ^0.14.0
import Redis from 'ioredis'; // version: ^5.0.0

import { validateUserData, sanitizeInput } from '../../utils/validation.util';
import { 
  validateLoginRequest, 
  validateRegistrationRequest, 
  validateMFASetupRequest, 
  validateTokenRequest 
} from '../validators/auth.validator';
import {
  PASSWORD_PATTERN,
  EMAIL_PATTERN,
  FHIR_VALIDATION_RULES,
  RATE_LIMIT_RULES
} from '../../constants/validation.constants';

// Initialize Redis client for validation caching
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1, // Use separate DB for validation cache
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Cache TTL for validation results (5 minutes)
const VALIDATION_CACHE_TTL = 300;

// Validation metrics collector
class ValidationMetrics {
  private static metrics: Map<string, { success: number; total: number }> = new Map();

  static trackValidation(type: string, success: boolean): void {
    const current = this.metrics.get(type) || { success: 0, total: 0 };
    current.total++;
    if (success) current.success++;
    this.metrics.set(type, current);
  }

  static getSuccessRate(type: string): number {
    const metrics = this.metrics.get(type);
    return metrics ? metrics.success / metrics.total : 1;
  }
}

// Interface for enhanced validation result
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  securityContext?: {
    hipaaCompliant: boolean;
    riskLevel: string;
    securityFlags: string[];
  };
  performanceMetrics?: {
    validationTime: number;
    cacheHit: boolean;
  };
}

/**
 * Enhanced validation middleware with HIPAA compliance and performance monitoring
 */
export default async function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestPath = req.path;
  const requestMethod = req.method;
  let cacheHit = false;

  try {
    // Generate cache key based on request path and body hash
    const cacheKey = `validation:${requestPath}:${JSON.stringify(req.body)}`;
    
    // Check validation cache
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      cacheHit = true;
      const validationResult = JSON.parse(cachedResult);
      if (validationResult.isValid) {
        ValidationMetrics.trackValidation(requestPath, true);
        return next();
      }
      res.status(400).json(validationResult);
      return;
    }

    // Sanitize input data
    const sanitizedData = sanitizeInput(req.body);
    req.body = sanitizedData;

    // Select appropriate validator based on request path
    let validationResult: ValidationResult;
    switch (true) {
      case requestPath.includes('/auth/login'):
        validationResult = await validateLoginRequest(req.body);
        break;
      case requestPath.includes('/auth/register'):
        validationResult = await validateRegistrationRequest(req.body);
        break;
      case requestPath.includes('/auth/mfa/setup'):
        validationResult = await validateMFASetupRequest(req.body);
        break;
      case requestPath.includes('/fhir'):
        validationResult = await validateFHIRRequest(req.body);
        break;
      default:
        validationResult = await validateGenericRequest(req.body);
    }

    // Add performance metrics
    validationResult.performanceMetrics = {
      validationTime: Date.now() - startTime,
      cacheHit
    };

    // Cache validation result
    await redis.setex(
      cacheKey,
      VALIDATION_CACHE_TTL,
      JSON.stringify(validationResult)
    );

    // Track validation metrics
    ValidationMetrics.trackValidation(requestPath, validationResult.isValid);

    if (!validationResult.isValid) {
      res.status(400).json(validationResult);
      return;
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      isValid: false,
      errors: [{ message: 'Internal validation error' }],
      performanceMetrics: {
        validationTime: Date.now() - startTime,
        cacheHit
      }
    });
  }
}

/**
 * HIPAA-compliant FHIR request validator
 */
async function validateFHIRRequest(data: any): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const securityFlags: string[] = [];

  // Validate FHIR resource structure
  if (!data.resourceType || !FHIR_VALIDATION_RULES.RESOURCE_TYPE_PATTERN.test(data.resourceType)) {
    errors.push({
      property: 'resourceType',
      constraints: {
        pattern: 'Invalid FHIR resource type'
      }
    } as ValidationError);
  }

  // Validate PHI fields for HIPAA compliance
  if (data.resourceType === 'Patient') {
    if (!validatePHIFields(data)) {
      securityFlags.push('PHI_VALIDATION_FAILED');
    }
  }

  const isValid = errors.length === 0 && securityFlags.length === 0;

  return {
    isValid,
    errors,
    securityContext: {
      hipaaCompliant: securityFlags.length === 0,
      riskLevel: securityFlags.length > 0 ? 'HIGH' : 'LOW',
      securityFlags
    }
  };
}

/**
 * Generic request validator with security checks
 */
async function validateGenericRequest(data: any): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const securityFlags: string[] = [];

  // Validate common fields
  if (data.email && !EMAIL_PATTERN.test(data.email)) {
    errors.push({
      property: 'email',
      constraints: {
        pattern: 'Invalid email format'
      }
    } as ValidationError);
  }

  if (data.password && !PASSWORD_PATTERN.test(data.password)) {
    errors.push({
      property: 'password',
      constraints: {
        pattern: 'Password does not meet security requirements'
      }
    } as ValidationError);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    securityContext: {
      hipaaCompliant: true,
      riskLevel: 'LOW',
      securityFlags
    }
  };
}

/**
 * Validates PHI fields for HIPAA compliance
 */
function validatePHIFields(data: any): boolean {
  const requiredPHIFields = ['identifier', 'name', 'birthDate'];
  const sensitiveFields = ['ssn', 'mrn'];

  // Check required PHI fields
  for (const field of requiredPHIFields) {
    if (!data[field]) return false;
  }

  // Check sensitive field encryption
  for (const field of sensitiveFields) {
    if (data[field] && !isFieldEncrypted(data[field])) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a field value is properly encrypted
 */
function isFieldEncrypted(value: string): boolean {
  // Check for encryption pattern (simplified for example)
  return value.startsWith('enc:');
}