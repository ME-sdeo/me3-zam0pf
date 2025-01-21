import { MedplumClient } from '@medplum/core'; // @medplum/core ^2.0.0
import { 
  IFHIRResource, 
  IFHIRValidationResult,
  IFHIRSearchParams
} from '../interfaces/fhir.interface';
import { validateFHIRResource, formatFHIRResource } from '../utils/fhir.util';
import { fhirConfig } from '../config/fhir.config';

// Constants for FHIR service configuration
const VALIDATION_TIMEOUT = 30000;
const MAX_SEARCH_RESULTS = 1000;
const CACHE_TTL = 300000; // 5 minutes
const MAX_RETRIES = 3;
const BATCH_SIZE = 100;

/**
 * Enhanced FHIR service implementing secure and compliant FHIR operations
 * Provides comprehensive validation, caching, and audit logging capabilities
 */
export class FHIRService {
  private readonly client: MedplumClient;
  private readonly resourceCache: Map<string, { data: IFHIRResource; timestamp: number }>;
  private readonly auditLogger: { info: (message: string, meta: any) => void; error: (message: string, meta: any) => void; };

  constructor() {
    this.client = new MedplumClient({
      baseUrl: fhirConfig.client.baseUrl,
      clientId: fhirConfig.client.clientId,
      fetch: this.secureFetch.bind(this)
    });

    this.resourceCache = new Map();
    this.initializeAuditLogger();
  }

  /**
   * Uploads a FHIR resource with enhanced security and validation
   * @param resource - FHIR resource to upload
   * @returns Promise resolving to uploaded resource
   */
  public async uploadResource(resource: IFHIRResource): Promise<IFHIRResource> {
    try {
      // Validate resource before upload
      const validationResult = await this.validateResource(resource);
      if (!validationResult.valid) {
        throw new Error(`Resource validation failed: ${validationResult.errors[0]?.message}`);
      }

      // Format resource for upload
      const formattedResource = formatFHIRResource(resource, {
        removeEmpty: true,
        sortArrays: true,
        validateMimeType: true
      });

      // Upload resource with retry mechanism
      const response = await this.retryOperation(async () => {
        const result = await this.client.createResource(formattedResource as any);
        return result as IFHIRResource;
      });

      // Update cache and audit log
      this.updateCache(response);
      this.auditLogger.info('Resource uploaded', {
        resourceType: response.resourceType,
        id: response.id,
        action: 'create'
      });

      return response;
    } catch (error) {
      this.handleError('uploadResource', error);
      throw error;
    }
  }

  /**
   * Retrieves a FHIR resource with caching and security checks
   * @param resourceType - Type of FHIR resource
   * @param id - Resource identifier
   * @returns Promise resolving to retrieved resource
   */
  public async getResource(resourceType: string, id: string): Promise<IFHIRResource> {
    try {
      // Check cache first
      const cacheKey = `${resourceType}/${id}`;
      const cachedResource = this.getCachedResource(cacheKey);
      if (cachedResource) {
        return cachedResource;
      }

      // Fetch resource with retry mechanism
      const response = await this.retryOperation(async () => {
        const result = await this.client.readResource(resourceType as any, id);
        return result as IFHIRResource;
      });

      // Update cache and audit log
      this.updateCache(response);
      this.auditLogger.info('Resource retrieved', {
        resourceType,
        id,
        action: 'read'
      });

      return response;
    } catch (error) {
      this.handleError('getResource', error);
      throw error;
    }
  }

  /**
   * Searches for FHIR resources with enhanced filtering and pagination
   * @param params - Search parameters
   * @returns Promise resolving to matching resources
   */
  public async searchResources(params: IFHIRSearchParams): Promise<IFHIRResource[]> {
    try {
      // Validate search parameters
      this.validateSearchParams(params);

      // Execute search with pagination
      const results: IFHIRResource[] = [];
      let page = 1;

      while (true) {
        const searchParams = this.buildSearchParams(params, page);
        const response = await this.retryOperation(async () => {
          return await this.client.search(params.resourceType as any, searchParams);
        });

        const resources = response.entry?.map(e => e.resource as IFHIRResource).filter(Boolean) || [];
        results.push(...resources);

        if (!response.link?.find(l => l.relation === 'next') || 
            results.length >= MAX_SEARCH_RESULTS) {
          break;
        }
        page++;
      }

      // Audit search operation
      this.auditLogger.info('Resources searched', {
        resourceType: params.resourceType,
        resultCount: results.length,
        filters: params.filters
      });

      return results;
    } catch (error) {
      this.handleError('searchResources', error);
      throw error;
    }
  }

  /**
   * Validates a FHIR resource with comprehensive rules
   * @param resource - Resource to validate
   * @returns Promise resolving to validation result
   */
  public async validateResource(resource: IFHIRResource): Promise<IFHIRValidationResult> {
    try {
      return await validateFHIRResource(resource, {
        timeoutMs: VALIDATION_TIMEOUT,
        validateProfile: true,
        strictMode: fhirConfig.validation.strictMode
      });
    } catch (error) {
      this.handleError('validateResource', error);
      throw error;
    }
  }

  /**
   * Secure fetch implementation with HIPAA-compliant headers
   */
  private async secureFetch(url: string, options: RequestInit): Promise<Response> {
    const secureOptions = {
      ...options,
      headers: {
        ...options.headers,
        'X-Request-ID': crypto.randomUUID(),
        'X-Client-Version': fhirConfig.client.version
      }
    };
    return await fetch(url, secureOptions);
  }

  /**
   * Initializes HIPAA-compliant audit logger
   */
  private initializeAuditLogger(): void {
    const logger = {
      info: (message: string, meta: any) => {
        console.info(`[FHIR Audit] ${message}`, {
          timestamp: new Date().toISOString(),
          ...meta
        });
      },
      error: (message: string, meta: any) => {
        console.error(`[FHIR Audit] ${message}`, {
          timestamp: new Date().toISOString(),
          ...meta
        });
      }
    };
    Object.defineProperty(this, 'auditLogger', {
      value: logger,
      writable: false,
      configurable: false
    });
  }

  /**
   * Retrieves resource from cache if valid
   */
  private getCachedResource(key: string): IFHIRResource | null {
    const cached = this.resourceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Updates resource cache with new data
   */
  private updateCache(resource: IFHIRResource): void {
    const key = `${resource.resourceType}/${resource.id}`;
    this.resourceCache.set(key, {
      data: resource,
      timestamp: Date.now()
    });
  }

  /**
   * Validates search parameters for compliance
   */
  private validateSearchParams(params: IFHIRSearchParams): void {
    if (!params.resourceType || !Object.values(fhirConfig.resourceTypes).includes(params.resourceType)) {
      throw new Error('Invalid resource type');
    }
    if (params.pagination?._count && params.pagination._count > MAX_SEARCH_RESULTS) {
      throw new Error(`Maximum result count exceeded: ${MAX_SEARCH_RESULTS}`);
    }
  }

  /**
   * Builds FHIR search parameters with pagination
   */
  private buildSearchParams(params: IFHIRSearchParams, page: number): Record<string, string> {
    const searchParams: Record<string, string> = {};
    
    // Add filters
    params.filters?.forEach(filter => {
      searchParams[filter.field] = `${filter.operator}${filter.value}`;
    });

    // Add pagination
    if (params.pagination) {
      searchParams._count = String(Math.min(params.pagination._count || BATCH_SIZE, BATCH_SIZE));
      searchParams._offset = String(((page - 1) * BATCH_SIZE));
    }

    return searchParams;
  }

  /**
   * Implements retry mechanism for FHIR operations
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Handles errors with audit logging
   */
  private handleError(operation: string, error: any): void {
    this.auditLogger.error(`FHIR operation failed: ${operation}`, {
      error: error.message,
      code: error.code,
      operation
    });
  }
}