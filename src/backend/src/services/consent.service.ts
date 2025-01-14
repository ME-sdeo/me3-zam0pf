/**
 * HIPAA-compliant consent management service for MyElixir healthcare data marketplace
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { Logger } from 'winston'; // v3.8.2
import { IConsent, ConsentStatus, CONSENT_STATUS_TRANSITIONS } from '../interfaces/consent.interface';
import ConsentModel from '../models/consent.model';
import { FabricService } from '../blockchain/services/fabric.service';
import { validateFHIRResource } from '../utils/validation.util';
import { CircuitBreaker } from 'opossum'; // v6.0.0
import { RedisCache } from '../utils/cache.util';
import { MetricsCollector } from '../utils/metrics.util';
import { v4 as uuidv4 } from 'uuid'; // v8.3.2

@injectable()
export class ConsentService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly logger: Logger,
    private readonly fabricService: FabricService,
    private readonly cache: RedisCache,
    private readonly metrics: MetricsCollector
  ) {
    // Initialize circuit breaker for blockchain operations
    this.circuitBreaker = new CircuitBreaker(
      async (operation: () => Promise<any>) => operation(),
      {
        timeout: 10000, // 10 seconds
        errorThresholdPercentage: 50,
        resetTimeout: 30000 // 30 seconds
      }
    );
  }

  /**
   * Creates a new HIPAA-compliant consent record with blockchain tracking
   * @param consentData - Consent data to be created
   * @returns Promise<IConsent> Created consent record
   */
  public async createConsent(consentData: Omit<IConsent, 'id'>): Promise<IConsent> {
    try {
      this.logger.info('Creating new consent record', {
        userId: consentData.userId,
        companyId: consentData.companyId,
        timestamp: new Date().toISOString()
      });

      // Generate unique ID for consent record
      const consentId = uuidv4();
      const consent: IConsent = {
        ...consentData,
        id: consentId,
        status: ConsentStatus.PENDING
      };

      // Validate consent data structure and HIPAA compliance
      const validationResult = await validateFHIRResource(consent);
      if (!validationResult.valid) {
        throw new Error(`Consent validation failed: ${validationResult.errors[0].message}`);
      }

      // Start MongoDB transaction
      const session = await ConsentModel.startSession();
      session.startTransaction();

      try {
        // Create consent record in database
        const createdConsent = await ConsentModel.createWithTransaction(consent, session);

        // Submit to blockchain with retry mechanism
        const blockchainResult = await this.circuitBreaker.fire(async () => {
          return await this.fabricService.submitConsent({
            id: consentId,
            patientId: consent.userId,
            providerId: consent.companyId,
            dataScope: consent.permissions.resourceTypes,
            validFrom: consent.validFrom,
            validTo: consent.validTo,
            status: 'ACTIVE',
            metadata: {
              hipaaCompliant: true,
              gdprCompliant: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        });

        // Verify blockchain submission
        const verified = await this.fabricService.verifyConsentChain(blockchainResult.id);
        if (!verified) {
          throw new Error('Blockchain verification failed');
        }

        // Commit transaction
        await session.commitTransaction();

        // Cache consent data
        await this.cache.set(
          `consent:${consentId}`,
          JSON.stringify(createdConsent),
          this.CACHE_TTL
        );

        // Track metrics
        this.metrics.incrementCounter('consent.created');

        this.logger.info('Consent record created successfully', {
          consentId,
          blockchainRef: blockchainResult.id,
          timestamp: new Date().toISOString()
        });

        return createdConsent;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      this.logger.error('Failed to create consent record', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Updates consent status with blockchain synchronization
   * @param consentId - ID of consent to update
   * @param newStatus - New consent status
   * @returns Promise<IConsent> Updated consent record
   */
  public async updateConsentStatus(
    consentId: string,
    newStatus: ConsentStatus
  ): Promise<IConsent> {
    try {
      this.logger.info('Updating consent status', {
        consentId,
        newStatus,
        timestamp: new Date().toISOString()
      });

      // Start MongoDB transaction
      const session = await ConsentModel.startSession();
      session.startTransaction();

      try {
        // Get current consent record
        const consent = await ConsentModel.findOne({ id: consentId }).session(session);
        if (!consent) {
          throw new Error('Consent record not found');
        }

        // Validate status transition
        if (!this.validateConsentStatus(consent.status, newStatus)) {
          throw new Error('Invalid consent status transition');
        }

        // Update consent status in database
        const updatedConsent = await ConsentModel.updateConsentStatus(
          consentId,
          newStatus,
          session
        );

        // Update blockchain record
        const blockchainResult = await this.circuitBreaker.fire(async () => {
          return await this.fabricService.updateConsentStatus(consentId, newStatus);
        });

        // Verify blockchain update
        const verified = await this.fabricService.verifyConsentChain(blockchainResult.id);
        if (!verified) {
          throw new Error('Blockchain verification failed');
        }

        // Commit transaction
        await session.commitTransaction();

        // Invalidate cache
        await this.cache.del(`consent:${consentId}`);

        // Track metrics
        this.metrics.incrementCounter('consent.updated');

        this.logger.info('Consent status updated successfully', {
          consentId,
          newStatus,
          blockchainRef: blockchainResult.id,
          timestamp: new Date().toISOString()
        });

        return updatedConsent;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      this.logger.error('Failed to update consent status', {
        consentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Retrieves paginated user consents with blockchain verification
   * @param userId - User ID to get consents for
   * @param options - Pagination options
   * @returns Promise<{ consents: IConsent[], total: number }>
   */
  public async getUserConsents(
    userId: string,
    options: { page: number; limit: number }
  ): Promise<{ consents: IConsent[]; total: number }> {
    try {
      this.logger.info('Retrieving user consents', {
        userId,
        options,
        timestamp: new Date().toISOString()
      });

      // Check cache for results
      const cacheKey = `user-consents:${userId}:${options.page}:${options.limit}`;
      const cachedResult = await this.cache.get(cacheKey);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Query consents with pagination
      const { consents, total } = await ConsentModel.findWithPagination(
        { userId },
        options
      );

      // Verify blockchain records
      for (const consent of consents) {
        const verified = await this.fabricService.verifyConsentChain(consent.id);
        if (!verified) {
          this.logger.warn('Consent blockchain verification failed', {
            consentId: consent.id,
            timestamp: new Date().toISOString()
          });
        }
      }

      const result = { consents, total };

      // Cache results
      await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

      // Track metrics
      this.metrics.incrementCounter('consent.retrieved');

      return result;
    } catch (error) {
      this.logger.error('Failed to retrieve user consents', {
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validates consent status transitions
   * @param currentStatus - Current consent status
   * @param newStatus - New consent status
   * @returns boolean indicating if transition is valid
   */
  private validateConsentStatus(
    currentStatus: ConsentStatus,
    newStatus: ConsentStatus
  ): boolean {
    const validTransitions = CONSENT_STATUS_TRANSITIONS[currentStatus];
    return validTransitions.includes(newStatus);
  }
}

export default ConsentService;