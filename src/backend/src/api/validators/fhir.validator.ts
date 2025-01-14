import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { FHIRResource, FHIRValidationResult } from '../../interfaces/fhir.interface';
import { validateFHIRResource } from '../../utils/fhir.util';
import { FHIR_VALIDATION } from '../../constants/validation.constants';

/**
 * Performance monitoring decorator for validation metrics
 */
function trackValidationPerformance() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = process.hrtime();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1000000;
        // Log validation performance metric
        console.log(`FHIR Validation Performance: ${propertyKey} took ${duration}ms`);
      }
    };
    return descriptor;
  };
}

/**
 * Express middleware for validating FHIR resource requests
 * Implements comprehensive validation including format, security, and compliance checks
 */
@trackValidationPerformance()
export async function validateFHIRRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate content type
    if (req.headers['content-type'] !== 'application/json') {
      res.status(400).json({
        error: 'Invalid content type. Expected application/json'
      });
      return;
    }

    // Validate request body size
    if (req.headers['content-length'] && 
        parseInt(req.headers['content-length']) > FHIR_VALIDATION.MAX_RESOURCE_SIZE) {
      res.status(413).json({
        error: 'Request body exceeds maximum size limit'
      });
      return;
    }

    const resource = req.body as FHIRResource;

    // Basic structure validation
    if (!resource || !resource.resourceType) {
      res.status(400).json({
        error: 'Invalid FHIR resource structure'
      });
      return;
    }

    // Validate resource type format
    if (!FHIR_VALIDATION.RESOURCE_TYPE_PATTERN.test(resource.resourceType)) {
      res.status(400).json({
        error: 'Invalid FHIR resource type format'
      });
      return;
    }

    // Validate resource ID if present
    if (resource.id && !FHIR_VALIDATION.ID_PATTERN.test(resource.id)) {
      res.status(400).json({
        error: 'Invalid FHIR resource ID format'
      });
      return;
    }

    // Validate version if present
    if (resource.meta?.versionId && 
        !FHIR_VALIDATION.VERSION_PATTERN.test(resource.meta.versionId)) {
      res.status(400).json({
        error: 'Invalid FHIR version format'
      });
      return;
    }

    // Comprehensive FHIR validation
    const validationResult: FHIRValidationResult = await validateFHIRResource(resource, {
      strictMode: true,
      validateReferences: true,
      validateTerminology: true
    });

    if (!validationResult.valid) {
      res.status(400).json({
        error: 'FHIR validation failed',
        details: validationResult.errors,
        warnings: validationResult.warnings,
        stats: validationResult.stats
      });
      return;
    }

    // Store validation result for downstream use
    res.locals.validationResult = validationResult;
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Internal validation error',
      message: error.message
    });
  }
}

/**
 * Express middleware for validating FHIR search parameters
 * Implements validation for search queries including filters, pagination, and security checks
 */
@trackValidationPerformance()
export async function validateFHIRSearchParams(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resourceType, _count, _offset, _sort, _include, ...searchParams } = req.query;

    // Validate resource type
    if (!resourceType || !FHIR_VALIDATION.RESOURCE_TYPE_PATTERN.test(resourceType as string)) {
      res.status(400).json({
        error: 'Invalid or missing resource type'
      });
      return;
    }

    // Validate pagination parameters
    if (_count && (isNaN(Number(_count)) || Number(_count) < 1 || Number(_count) > 1000)) {
      res.status(400).json({
        error: 'Invalid _count parameter. Must be between 1 and 1000'
      });
      return;
    }

    if (_offset && (isNaN(Number(_offset)) || Number(_offset) < 0)) {
      res.status(400).json({
        error: 'Invalid _offset parameter. Must be non-negative'
      });
      return;
    }

    // Validate sort parameters
    if (_sort) {
      const sortFields = (_sort as string).split(',');
      const validSortPattern = /^[-+]?[A-Za-z0-9_.]+$/;
      
      if (!sortFields.every(field => validSortPattern.test(field))) {
        res.status(400).json({
          error: 'Invalid _sort parameter format'
        });
        return;
      }
    }

    // Validate include parameters
    if (_include) {
      const includeParams = Array.isArray(_include) ? _include : [_include];
      const validIncludePattern = /^[A-Za-z]+:[A-Za-z0-9_.]+$/;
      
      if (!includeParams.every(param => validIncludePattern.test(param as string))) {
        res.status(400).json({
          error: 'Invalid _include parameter format'
        });
        return;
      }
    }

    // Validate search parameters
    const validSearchPattern = /^[A-Za-z0-9_.]+$/;
    for (const [key, value] of Object.entries(searchParams)) {
      if (!validSearchPattern.test(key)) {
        res.status(400).json({
          error: `Invalid search parameter name: ${key}`
        });
        return;
      }

      if (typeof value === 'string' && value.length > FHIR_VALIDATION.MAX_RESOURCE_SIZE) {
        res.status(400).json({
          error: `Search parameter value too large: ${key}`
        });
        return;
      }
    }

    // Store validated search parameters for downstream use
    res.locals.searchParams = {
      resourceType,
      pagination: {
        _count: _count ? Number(_count) : undefined,
        _offset: _offset ? Number(_offset) : undefined
      },
      sort: _sort ? (_sort as string).split(',') : undefined,
      include: _include ? (Array.isArray(_include) ? _include : [_include]) : undefined,
      filters: searchParams
    };

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Internal search parameter validation error',
      message: error.message
    });
  }
}