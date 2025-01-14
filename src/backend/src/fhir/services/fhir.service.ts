import { injectable } from 'inversify'; // ^6.0.1
import { Logger } from 'winston'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { EncryptionService, AuditService } from '@medplum/core'; // ^2.0.0
import NodeCache from 'node-cache'; // ^5.1.2
import { 
  FHIRResource, 
  FHIRValidationResult,
  FHIR_VERSION,
  FHIR_VALIDATION_THRESHOLD 
} from '../../interfaces/fhir.interface';

/**
 * Constants for FHIR service configuration
 */
const CACHE_TTL = 300; // 5 minutes cache TTL
const CIRCUIT_BREAKER_TIMEOUT = 3000; // 3 seconds timeout
const MAX_RETRIES = 3;
const ENCRYPTION_FIELDS = ['identifier', 'name', 'telecom', 'address'];

/**
 * Enhanced FHIR service implementing secure and compliant FHIR resource management
 * with field-level encryption, audit logging, and comprehensive error handling.
 */
@injectable()
export class FHIRService {
  private readonly cache: NodeCache;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly medplumAdapter: any,
    private readonly validator: any,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly logger: Logger
  ) {
    // Initialize cache with TTL
    this.cache = new NodeCache({
      stdTTL: CACHE_TTL,
      checkperiod: CACHE_TTL * 0.2,
      useClones: false
    });

    // Configure circuit breaker
    this.breaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
      return await operation();
    }, {
      timeout: CIRCUIT_BREAKER_TIMEOUT,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      rollingCountTimeout: 10000
    });

    this.initializeBreaker();
  }

  /**
   * Creates a new FHIR resource with encryption and audit logging
   * @param resource The FHIR resource to create
   * @returns Promise<FHIRResource> The created and encrypted resource
   */
  async createFHIRResource(resource: FHIRResource): Promise<FHIRResource> {
    try {
      // Validate resource
      const validationResult = await this.validateResource(resource);
      if (!validationResult.valid) {
        throw new Error(`Resource validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // Encrypt sensitive fields
      const encryptedResource = await this.encryptSensitiveFields(resource);

      // Create resource with circuit breaker
      const createdResource = await this.breaker.fire(async () => {
        return await this.medplumAdapter.createResource(encryptedResource);
      });

      // Cache the created resource
      const cacheKey = this.generateCacheKey(createdResource.resourceType, createdResource.id);
      this.cache.set(cacheKey, createdResource);

      // Audit log the creation
      await this.auditService.logResourceCreation({
        resourceType: resource.resourceType,
        resourceId: createdResource.id,
        action: 'create',
        timestamp: new Date().toISOString()
      });

      return createdResource;
    } catch (error) {
      this.logger.error('Error creating FHIR resource:', error);
      throw error;
    }
  }

  /**
   * Retrieves and decrypts a FHIR resource with caching
   * @param resourceType The type of FHIR resource
   * @param id The resource ID
   * @returns Promise<FHIRResource> The decrypted FHIR resource
   */
  async getFHIRResource(resourceType: string, id: string): Promise<FHIRResource> {
    try {
      const cacheKey = this.generateCacheKey(resourceType, id);
      
      // Check cache first
      const cachedResource = this.cache.get<FHIRResource>(cacheKey);
      if (cachedResource) {
        return await this.decryptSensitiveFields(cachedResource);
      }

      // Retrieve resource with circuit breaker
      const resource = await this.breaker.fire(async () => {
        return await this.medplumAdapter.readResource(resourceType, id);
      });

      if (!resource) {
        throw new Error(`Resource ${resourceType}/${id} not found`);
      }

      // Decrypt sensitive fields
      const decryptedResource = await this.decryptSensitiveFields(resource);

      // Cache the decrypted resource
      this.cache.set(cacheKey, decryptedResource);

      // Audit log the access
      await this.auditService.logResourceAccess({
        resourceType,
        resourceId: id,
        action: 'read',
        timestamp: new Date().toISOString()
      });

      return decryptedResource;
    } catch (error) {
      this.logger.error('Error retrieving FHIR resource:', error);
      throw error;
    }
  }

  /**
   * Updates an existing FHIR resource with validation and security
   * @param resource The FHIR resource to update
   * @returns Promise<FHIRResource> The updated resource
   */
  async updateFHIRResource(resource: FHIRResource): Promise<FHIRResource> {
    try {
      // Validate resource
      const validationResult = await this.validateResource(resource);
      if (!validationResult.valid) {
        throw new Error(`Resource validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // Encrypt sensitive fields
      const encryptedResource = await this.encryptSensitiveFields(resource);

      // Update resource with circuit breaker
      const updatedResource = await this.breaker.fire(async () => {
        return await this.medplumAdapter.updateResource(encryptedResource);
      });

      // Update cache
      const cacheKey = this.generateCacheKey(updatedResource.resourceType, updatedResource.id);
      this.cache.set(cacheKey, updatedResource);

      // Audit log the update
      await this.auditService.logResourceUpdate({
        resourceType: resource.resourceType,
        resourceId: resource.id,
        action: 'update',
        timestamp: new Date().toISOString()
      });

      return updatedResource;
    } catch (error) {
      this.logger.error('Error updating FHIR resource:', error);
      throw error;
    }
  }

  /**
   * Deletes a FHIR resource with audit logging
   * @param resourceType The type of FHIR resource
   * @param id The resource ID
   */
  async deleteFHIRResource(resourceType: string, id: string): Promise<void> {
    try {
      // Delete resource with circuit breaker
      await this.breaker.fire(async () => {
        await this.medplumAdapter.deleteResource(resourceType, id);
      });

      // Remove from cache
      const cacheKey = this.generateCacheKey(resourceType, id);
      this.cache.del(cacheKey);

      // Audit log the deletion
      await this.auditService.logResourceDeletion({
        resourceType,
        resourceId: id,
        action: 'delete',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error deleting FHIR resource:', error);
      throw error;
    }
  }

  /**
   * Validates a FHIR resource against schema and business rules
   * @param resource The resource to validate
   * @returns Promise<FHIRValidationResult> Validation result
   */
  private async validateResource(resource: FHIRResource): Promise<FHIRValidationResult> {
    return await this.validator.validate(resource);
  }

  /**
   * Encrypts sensitive fields in a FHIR resource
   * @param resource The resource to encrypt
   * @returns Promise<FHIRResource> Resource with encrypted fields
   */
  private async encryptSensitiveFields(resource: FHIRResource): Promise<FHIRResource> {
    const encryptedResource = { ...resource };
    for (const field of ENCRYPTION_FIELDS) {
      if (encryptedResource[field]) {
        encryptedResource[field] = await this.encryptionService.encrypt(
          encryptedResource[field]
        );
      }
    }
    return encryptedResource;
  }

  /**
   * Decrypts sensitive fields in a FHIR resource
   * @param resource The resource to decrypt
   * @returns Promise<FHIRResource> Resource with decrypted fields
   */
  private async decryptSensitiveFields(resource: FHIRResource): Promise<FHIRResource> {
    const decryptedResource = { ...resource };
    for (const field of ENCRYPTION_FIELDS) {
      if (decryptedResource[field]) {
        decryptedResource[field] = await this.encryptionService.decrypt(
          decryptedResource[field]
        );
      }
    }
    return decryptedResource;
  }

  /**
   * Generates a cache key for a resource
   * @param resourceType The type of FHIR resource
   * @param id The resource ID
   * @returns string Cache key
   */
  private generateCacheKey(resourceType: string, id: string): string {
    return `${resourceType}:${id}`;
  }

  /**
   * Initializes circuit breaker event handlers
   */
  private initializeBreaker(): void {
    this.breaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - FHIR service degraded');
    });

    this.breaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open - attempting recovery');
    });

    this.breaker.on('close', () => {
      this.logger.info('Circuit breaker closed - FHIR service recovered');
    });

    this.breaker.on('fallback', (error) => {
      this.logger.error('Circuit breaker fallback:', error);
    });
  }
}