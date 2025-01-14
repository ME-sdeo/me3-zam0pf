import { injectable } from 'inversify';
import { MedplumClient } from '@medplum/core'; // @medplum/core ^2.0.0
import { Logger } from 'winston'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import Redis from 'ioredis'; // ^5.0.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { FHIRResource, FHIRSearchParams, FHIRValidationResult } from '../../interfaces/fhir.interface';
import { fhirConfig } from '../../config/fhir.config';
import { FHIR_ERROR_CODES, FHIR_ERROR_MESSAGES, FHIR_VALIDATION_RULES } from '../../constants/fhir.constants';

// Constants for configuration
const MEDPLUM_TIMEOUT = 30000;
const MEDPLUM_RETRY_ATTEMPTS = 3;
const CACHE_TTL = 3600;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';

@injectable()
export class MedplumAdapter {
  private client: MedplumClient;
  private breaker: CircuitBreaker;
  private readonly encryptionKey: string;

  constructor(
    private readonly logger: Logger,
    private readonly encryptionService: typeof CryptoJS,
    private readonly cache: Redis
  ) {
    this.initializeClient();
    this.initializeCircuitBreaker();
    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
  }

  /**
   * Initializes the Medplum client with retry and timeout configuration
   */
  private initializeClient(): void {
    this.client = new MedplumClient({
      baseUrl: fhirConfig.server.baseUrl,
      clientId: fhirConfig.server.clientId,
      clientSecret: fhirConfig.server.clientSecret,
      timeout: MEDPLUM_TIMEOUT,
      retryAttempts: MEDPLUM_RETRY_ATTEMPTS
    });
  }

  /**
   * Initializes circuit breaker for Medplum client resilience
   */
  private initializeCircuitBreaker(): void {
    this.breaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
      return operation();
    }, {
      timeout: MEDPLUM_TIMEOUT,
      errorThresholdPercentage: CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: 30000
    });
  }

  /**
   * Creates a new FHIR resource with encryption and validation
   * @param resource The FHIR resource to create
   * @returns Promise<FHIRResource>
   */
  public async createResource(resource: FHIRResource): Promise<FHIRResource> {
    try {
      const validationResult = await this.validateResource(resource);
      if (!validationResult.valid) {
        throw new Error(FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT);
      }

      const encryptedResource = this.encryptSensitiveFields(resource);
      const cacheKey = `fhir:${resource.resourceType}:${resource.id}`;

      const result = await this.breaker.fire(async () => {
        const created = await this.client.createResource(encryptedResource);
        await this.cache.setex(cacheKey, CACHE_TTL, JSON.stringify(created));
        return created;
      });

      await this.logAuditTrail('create', result);
      return this.decryptSensitiveFields(result);
    } catch (error) {
      this.logger.error('Error creating FHIR resource', {
        error,
        resourceType: resource.resourceType,
        code: FHIR_ERROR_CODES.INVALID_RESOURCE
      });
      throw error;
    }
  }

  /**
   * Retrieves a FHIR resource by ID with caching
   * @param resourceType The type of FHIR resource
   * @param id The resource ID
   * @returns Promise<FHIRResource>
   */
  public async getResource(resourceType: string, id: string): Promise<FHIRResource> {
    const cacheKey = `fhir:${resourceType}:${id}`;
    
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return this.decryptSensitiveFields(JSON.parse(cached));
      }

      const result = await this.breaker.fire(async () => {
        return await this.client.readResource(resourceType, id);
      });

      await this.cache.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      await this.logAuditTrail('read', result);
      
      return this.decryptSensitiveFields(result);
    } catch (error) {
      this.logger.error('Error retrieving FHIR resource', {
        error,
        resourceType,
        id,
        code: FHIR_ERROR_CODES.RESOURCE_NOT_FOUND
      });
      throw error;
    }
  }

  /**
   * Searches for FHIR resources with pagination and filtering
   * @param params Search parameters
   * @returns Promise<FHIRResource[]>
   */
  public async searchResources(params: FHIRSearchParams): Promise<FHIRResource[]> {
    try {
      const result = await this.breaker.fire(async () => {
        return await this.client.search(params.resourceType, {
          ...params.filters.reduce((acc, filter) => ({
            ...acc,
            [filter.field]: filter.value
          }), {})
        });
      });

      await this.logAuditTrail('search', { params });
      return result.entry.map(entry => this.decryptSensitiveFields(entry.resource));
    } catch (error) {
      this.logger.error('Error searching FHIR resources', {
        error,
        params,
        code: FHIR_ERROR_CODES.SERVER_ERROR
      });
      throw error;
    }
  }

  /**
   * Validates a FHIR resource against R4 specification
   * @param resource The resource to validate
   * @returns Promise<FHIRValidationResult>
   */
  private async validateResource(resource: FHIRResource): Promise<FHIRValidationResult> {
    const requiredFields = FHIR_VALIDATION_RULES.REQUIRED_FIELDS[resource.resourceType];
    const errors = [];

    if (!requiredFields) {
      errors.push({
        type: 'Required',
        message: FHIR_ERROR_MESSAGES.INVALID_RESOURCE_TYPE
      });
    }

    for (const field of requiredFields || []) {
      if (!resource[field]) {
        errors.push({
          type: 'Required',
          field,
          message: FHIR_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      stats: {
        totalFields: Object.keys(resource).length,
        validFields: Object.keys(resource).length - errors.length,
        errorCount: errors.length,
        warningCount: 0,
        successRate: errors.length === 0 ? 1 : 0
      }
    };
  }

  /**
   * Encrypts sensitive fields in FHIR resource
   * @param resource The resource to encrypt
   * @returns FHIRResource
   */
  private encryptSensitiveFields(resource: FHIRResource): FHIRResource {
    const sensitiveFields = ['name', 'birthDate', 'address'];
    const encrypted = { ...resource };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encryptionService.AES.encrypt(
          JSON.stringify(encrypted[field]),
          this.encryptionKey
        ).toString();
      }
    }

    return encrypted;
  }

  /**
   * Decrypts sensitive fields in FHIR resource
   * @param resource The resource to decrypt
   * @returns FHIRResource
   */
  private decryptSensitiveFields(resource: FHIRResource): FHIRResource {
    const sensitiveFields = ['name', 'birthDate', 'address'];
    const decrypted = { ...resource };

    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          const bytes = this.encryptionService.AES.decrypt(
            decrypted[field],
            this.encryptionKey
          );
          decrypted[field] = JSON.parse(bytes.toString(this.encryptionService.enc.Utf8));
        } catch (error) {
          this.logger.error('Error decrypting field', { field, error });
        }
      }
    }

    return decrypted;
  }

  /**
   * Logs audit trail for FHIR operations
   * @param operation The operation performed
   * @param details Operation details
   */
  private async logAuditTrail(operation: string, details: any): Promise<void> {
    await this.logger.info('FHIR Audit Trail', {
      timestamp: new Date().toISOString(),
      operation,
      details,
      user: this.client.getUserId(),
      ip: process.env.REQUEST_IP
    });
  }
}