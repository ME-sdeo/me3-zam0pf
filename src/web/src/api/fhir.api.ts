import { MedplumClient } from '@medplum/core'; // @medplum/core ^2.0.0
import { Resource } from '@medplum/fhirtypes'; // @medplum/fhirtypes ^2.0.0
import axios from 'axios'; // axios ^1.4.0
import { 
  IFHIRResource, 
  IFHIRSearchParams,
  IFHIRValidationResult 
} from '../interfaces/fhir.interface';
import { fhirConfig } from '../config/fhir.config';
import { validateFHIRResource } from '../utils/fhir.util';

// Global constants for API configuration
const FHIR_API_TIMEOUT = 30000;
const FHIR_API_RETRY_ATTEMPTS = 3;
const FHIR_API_CACHE_DURATION = 300000; // 5 minutes
const FHIR_API_REQUEST_DEDUP_WINDOW = 5000; // 5 seconds

// Request deduplication cache
const requestCache = new Map<string, { timestamp: number; promise: Promise<any> }>();

/**
 * Generates a cache key for request deduplication
 */
const generateCacheKey = (method: string, url: string, data?: any): string => {
  return `${method}:${url}:${data ? JSON.stringify(data) : ''}`;
};

/**
 * Cleans expired entries from the request cache
 */
const cleanRequestCache = (): void => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > FHIR_API_REQUEST_DEDUP_WINDOW) {
      requestCache.delete(key);
    }
  }
};

/**
 * Creates an axios instance with FHIR-specific configuration
 */
const fhirAxios = axios.create({
  baseURL: fhirConfig.client.baseUrl,
  timeout: FHIR_API_TIMEOUT,
  headers: {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json',
    ...fhirConfig.client.headers
  }
});

/**
 * Uploads a FHIR resource to the Medplum server with enhanced validation
 * @param resource - The FHIR resource to upload
 * @returns Promise resolving to the uploaded resource
 */
export async function uploadFHIRResource(resource: IFHIRResource): Promise<IFHIRResource> {
  // Validate resource before upload
  const validationResult: IFHIRValidationResult = await validateFHIRResource(resource);
  if (!validationResult.valid) {
    throw new Error(`Resource validation failed: ${validationResult.errors[0]?.message}`);
  }

  // Generate cache key for deduplication
  const cacheKey = generateCacheKey('POST', `/fhir/R4/${resource.resourceType}`, resource);

  // Check for existing request
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FHIR_API_REQUEST_DEDUP_WINDOW) {
    return cached.promise;
  }

  // Create new request promise
  const requestPromise = new Promise<IFHIRResource>(async (resolve, reject) => {
    let retryCount = 0;

    while (retryCount < FHIR_API_RETRY_ATTEMPTS) {
      try {
        const response = await fhirAxios.post<IFHIRResource>(
          `/fhir/R4/${resource.resourceType}`,
          resource
        );

        // Clean request cache periodically
        cleanRequestCache();
        
        resolve(response.data);
        return;
      } catch (error) {
        if (retryCount === FHIR_API_RETRY_ATTEMPTS - 1) {
          reject(error);
          return;
        }
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
      }
    }
  });

  // Cache the request promise
  requestCache.set(cacheKey, {
    timestamp: Date.now(),
    promise: requestPromise
  });

  return requestPromise;
}

/**
 * Searches for FHIR resources with enhanced filtering and pagination
 * @param searchParams - Search parameters for FHIR resources
 * @returns Promise resolving to array of matching resources
 */
export async function searchFHIRResources(searchParams: IFHIRSearchParams): Promise<IFHIRResource[]> {
  // Build query parameters
  const queryParams = new URLSearchParams();
  
  // Add filters
  searchParams.filters.forEach(filter => {
    const paramName = filter.modifier ? 
      `${filter.field}:${filter.modifier}` : 
      filter.field;
    queryParams.append(paramName, `${filter.operator}${filter.value}`);
  });

  // Add pagination
  if (searchParams.pagination._count) {
    queryParams.append('_count', searchParams.pagination._count.toString());
  }
  if (searchParams.pagination._offset) {
    queryParams.append('_offset', searchParams.pagination._offset.toString());
  }

  // Generate cache key
  const cacheKey = generateCacheKey('GET', `/fhir/R4/${searchParams.resourceType}`, queryParams.toString());

  // Check for existing request
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FHIR_API_REQUEST_DEDUP_WINDOW) {
    return cached.promise;
  }

  // Create new request promise
  const requestPromise = new Promise<IFHIRResource[]>(async (resolve, reject) => {
    let retryCount = 0;

    while (retryCount < FHIR_API_RETRY_ATTEMPTS) {
      try {
        const response = await fhirAxios.get<{ entry: { resource: IFHIRResource }[] }>(
          `/fhir/R4/${searchParams.resourceType}`,
          { params: queryParams }
        );

        // Clean request cache periodically
        cleanRequestCache();

        resolve(response.data.entry?.map(e => e.resource) || []);
        return;
      } catch (error) {
        if (retryCount === FHIR_API_RETRY_ATTEMPTS - 1) {
          reject(error);
          return;
        }
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
      }
    }
  });

  // Cache the request promise
  requestCache.set(cacheKey, {
    timestamp: Date.now(),
    promise: requestPromise
  });

  return requestPromise;
}