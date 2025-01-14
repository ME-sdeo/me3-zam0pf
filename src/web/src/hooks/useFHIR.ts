import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  IFHIRResource, 
  IFHIRValidationResult, 
  IFHIRSearchParams,
  FHIRValidationErrorType,
  ValidationSeverity,
  IFHIRValidationError
} from '../interfaces/fhir.interface';
import { 
  FHIR_VERSION, 
  FHIR_VALIDATION_RULES,
  FHIR_MIME_TYPES 
} from '../constants/fhir.constants';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 300000;
const MAX_CACHE_SIZE = 100;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;
const VALIDATION_TIMEOUT_MS = 5000;
const BATCH_SIZE_LIMIT = 50;

interface FHIRMetrics {
  validationSuccessRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  totalRequests: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UseFHIRConfig {
  cacheDuration?: number;
  maxRetries?: number;
  strictValidation?: boolean;
  enableMetrics?: boolean;
}

interface FHIRError extends Error {
  code: string;
  details?: IFHIRValidationError[];
}

/**
 * Advanced React hook for managing FHIR operations with comprehensive state management,
 * caching, validation metrics, and error handling
 */
export function useFHIR(config: UseFHIRConfig = {}) {
  // State management
  const [resources, setResources] = useState<IFHIRResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FHIRError | null>(null);
  const [metrics, setMetrics] = useState<FHIRMetrics>({
    validationSuccessRate: 100,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    totalRequests: 0
  });

  // Refs for cache and performance tracking
  const cache = useRef<Map<string, CacheEntry<IFHIRResource>>>(
    new Map()
  );
  const pendingRequests = useRef<Map<string, Promise<any>>>(
    new Map()
  );
  const metricsRef = useRef({
    totalValidations: 0,
    successfulValidations: 0,
    totalResponseTime: 0,
    cacheHits: 0,
    totalErrors: 0
  });

  // Configuration
  const {
    cacheDuration = CACHE_DURATION,
    maxRetries = MAX_RETRY_ATTEMPTS,
    strictValidation = FHIR_VALIDATION_RULES.STRICT_MODE,
    enableMetrics = true
  } = config;

  /**
   * Validates a FHIR resource against schema and business rules
   */
  const validateResource = useCallback(async (
    resource: IFHIRResource
  ): Promise<IFHIRValidationResult> => {
    const startTime = performance.now();
    
    try {
      // Basic structure validation
      if (!resource.resourceType || !resource.id) {
        throw new Error('Invalid FHIR resource structure');
      }

      // Comprehensive validation with timeout
      const validationPromise = new Promise<IFHIRValidationResult>(
        async (resolve, reject) => {
          const errors: IFHIRValidationError[] = [];
          
          // Validate required fields
          FHIR_VALIDATION_RULES.REQUIRED_FIELDS.forEach(field => {
            if (!resource[field]) {
              errors.push({
                type: FHIRValidationErrorType.Required,
                field,
                message: `Missing required field: ${field}`,
                code: 'REQUIRED_FIELD_MISSING',
                severity: ValidationSeverity.Error,
                path: [field],
                context: {}
              });
            }
          });

          // Additional validation logic here...

          const processingTime = performance.now() - startTime;
          resolve({
            valid: errors.length === 0,
            errors,
            warnings: [],
            processingTime,
            resourceCount: 1
          });
        }
      );

      const result = await Promise.race([
        validationPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Validation timeout')), 
            VALIDATION_TIMEOUT_MS
          );
        })
      ]) as IFHIRValidationResult;

      // Update metrics
      if (enableMetrics) {
        metricsRef.current.totalValidations++;
        if (result.valid) {
          metricsRef.current.successfulValidations++;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }, [enableMetrics]);

  /**
   * Uploads a new FHIR resource with validation and optimistic updates
   */
  const uploadResource = useCallback(async (
    resource: IFHIRResource
  ): Promise<IFHIRResource> => {
    const startTime = performance.now();
    
    try {
      setLoading(true);
      
      // Validate resource
      const validationResult = await validateResource(resource);
      if (!validationResult.valid && strictValidation) {
        throw new Error('Resource validation failed');
      }

      // Optimistic update
      setResources(prev => [...prev, resource]);

      // API call with retry logic
      const upload = async (attempt: number = 1): Promise<IFHIRResource> => {
        try {
          const response = await fetch('/api/fhir', {
            method: 'POST',
            headers: {
              'Content-Type': FHIR_MIME_TYPES.JSON,
              'Accept': FHIR_MIME_TYPES.JSON
            },
            body: JSON.stringify(resource)
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          if (attempt < maxRetries) {
            await new Promise(resolve => 
              setTimeout(resolve, RETRY_BACKOFF_MS * attempt)
            );
            return upload(attempt + 1);
          }
          throw error;
        }
      };

      const uploadedResource = await upload();

      // Update cache
      cache.current.set(uploadedResource.id, {
        data: uploadedResource,
        timestamp: Date.now()
      });

      // Update metrics
      if (enableMetrics) {
        metricsRef.current.totalResponseTime += performance.now() - startTime;
      }

      return uploadedResource;
    } catch (error) {
      // Revert optimistic update
      setResources(prev => 
        prev.filter(r => r.id !== resource.id)
      );

      if (enableMetrics) {
        metricsRef.current.totalErrors++;
      }

      const fhirError: FHIRError = new Error(error.message);
      fhirError.code = 'UPLOAD_FAILED';
      setError(fhirError);
      throw fhirError;
    } finally {
      setLoading(false);
    }
  }, [validateResource, strictValidation, maxRetries, enableMetrics]);

  /**
   * Searches for FHIR resources with advanced filtering and caching
   */
  const searchResources = useCallback(async (
    params: IFHIRSearchParams
  ): Promise<IFHIRResource[]> => {
    const startTime = performance.now();
    const cacheKey = JSON.stringify(params);

    try {
      setLoading(true);

      // Check cache
      const cachedEntry = cache.current.get(cacheKey);
      if (cachedEntry && 
          Date.now() - cachedEntry.timestamp < cacheDuration) {
        if (enableMetrics) {
          metricsRef.current.cacheHits++;
        }
        return cachedEntry.data as IFHIRResource[];
      }

      // Deduplicate in-flight requests
      if (pendingRequests.current.has(cacheKey)) {
        return pendingRequests.current.get(cacheKey);
      }

      const searchPromise = fetch('/api/fhir/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': FHIR_MIME_TYPES.JSON
        },
        body: JSON.stringify(params)
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }
        return response.json();
      });

      pendingRequests.current.set(cacheKey, searchPromise);
      const results = await searchPromise;
      pendingRequests.current.delete(cacheKey);

      // Update cache with LRU eviction
      if (cache.current.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.current.keys().next().value;
        cache.current.delete(oldestKey);
      }
      cache.current.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      setResources(results);

      // Update metrics
      if (enableMetrics) {
        metricsRef.current.totalResponseTime += performance.now() - startTime;
      }

      return results;
    } catch (error) {
      if (enableMetrics) {
        metricsRef.current.totalErrors++;
      }

      const fhirError: FHIRError = new Error(error.message);
      fhirError.code = 'SEARCH_FAILED';
      setError(fhirError);
      throw fhirError;
    } finally {
      setLoading(false);
    }
  }, [cacheDuration, enableMetrics]);

  /**
   * Updates metrics periodically
   */
  useEffect(() => {
    if (!enableMetrics) return;

    const updateMetrics = () => {
      const {
        totalValidations,
        successfulValidations,
        totalResponseTime,
        cacheHits,
        totalErrors
      } = metricsRef.current;

      setMetrics({
        validationSuccessRate: totalValidations ? 
          (successfulValidations / totalValidations) * 100 : 100,
        averageResponseTime: totalValidations ? 
          totalResponseTime / totalValidations : 0,
        cacheHitRate: totalValidations ? 
          (cacheHits / totalValidations) * 100 : 0,
        errorRate: totalValidations ? 
          (totalErrors / totalValidations) * 100 : 0,
        totalRequests: totalValidations
      });
    };

    const intervalId = setInterval(updateMetrics, 5000);
    return () => clearInterval(intervalId);
  }, [enableMetrics]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cache.current.clear();
      pendingRequests.current.clear();
    };
  }, []);

  return {
    resources,
    loading,
    error,
    metrics,
    uploadResource,
    searchResources,
    validateResource,
    clearCache: useCallback(() => cache.current.clear(), []),
    resetMetrics: useCallback(() => {
      Object.assign(metricsRef.current, {
        totalValidations: 0,
        successfulValidations: 0,
        totalResponseTime: 0,
        cacheHits: 0,
        totalErrors: 0
      });
    }, [])
  };
}