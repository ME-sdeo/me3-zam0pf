/**
 * HIPAA-compliant background job processor for consent operations
 * Implements blockchain-based consent tracking with Hyperledger Fabric
 * @version 1.0.0
 */

import { Job } from 'bull'; // v4.10.0
import { Logger } from '@nestjs/common'; // v8.0.0
import { injectable } from '@nestjs/common'; // v8.0.0
import { CircuitBreaker } from 'opossum'; // v6.0.0
import { ConsentService } from '../../services/consent.service';
import { IConsent } from '../../interfaces/consent.interface';
import { validateFHIRResource } from '../../utils/validation.util';
import { FHIRValidationResult } from '../../interfaces/fhir.interface';

/**
 * Interface for consent job data with enhanced security context
 */
interface ConsentJobData {
  operationType: 'create' | 'update' | 'revoke';
  consentData: IConsent;
  userId: string;
  companyId: string;
  metadata: {
    requestId: string;
    timestamp: string;
    hipaaCompliant: boolean;
    source: string;
  };
}

/**
 * HIPAA-compliant processor for handling consent-related background jobs
 */
@injectable()
export class ConsentProcessor {
  private readonly logger: Logger;
  private readonly blockchainBreaker: CircuitBreaker;
  private readonly MAX_RETRIES = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

  constructor(private readonly consentService: ConsentService) {
    this.logger = new Logger('ConsentProcessor');

    // Initialize circuit breaker for blockchain operations
    this.blockchainBreaker = new CircuitBreaker(
      async (operation: () => Promise<any>) => operation(),
      {
        timeout: this.CIRCUIT_BREAKER_TIMEOUT,
        resetTimeout: 60000, // 1 minute
        errorThresholdPercentage: 50,
        rollingCountTimeout: 60000
      }
    );

    // Configure circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Process consent jobs with HIPAA compliance and blockchain verification
   * @param job Bull queue job containing consent operation data
   */
  public async process(job: Job<ConsentJobData>): Promise<void> {
    try {
      this.logger.log({
        message: 'Processing consent job',
        jobId: job.id,
        operation: job.data.operationType,
        timestamp: new Date().toISOString(),
        requestId: job.data.metadata.requestId
      });

      // Validate job data
      await this.validateJobData(job.data);

      // Process based on operation type
      switch (job.data.operationType) {
        case 'create':
          await this.handleCreateConsent(job);
          break;
        case 'update':
          await this.handleUpdateConsent(job);
          break;
        case 'revoke':
          await this.handleRevokeConsent(job);
          break;
        default:
          throw new Error(`Unsupported operation type: ${job.data.operationType}`);
      }

      this.logger.log({
        message: 'Consent job processed successfully',
        jobId: job.id,
        operation: job.data.operationType,
        timestamp: new Date().toISOString(),
        requestId: job.data.metadata.requestId
      });
    } catch (error) {
      this.logger.error({
        message: 'Consent job processing failed',
        jobId: job.id,
        operation: job.data.operationType,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: job.data.metadata.requestId
      });

      // Determine if job should be retried
      if (job.attemptsMade < this.MAX_RETRIES) {
        throw error; // Bull will retry the job
      } else {
        // Log final failure
        this.logger.error({
          message: 'Max retries exceeded for consent job',
          jobId: job.id,
          operation: job.data.operationType,
          timestamp: new Date().toISOString(),
          requestId: job.data.metadata.requestId
        });
      }
    }
  }

  /**
   * Handle consent creation with blockchain integration
   */
  private async handleCreateConsent(job: Job<ConsentJobData>): Promise<void> {
    const { consentData, metadata } = job.data;

    // Create consent with blockchain tracking
    await this.blockchainBreaker.fire(async () => {
      const createdConsent = await this.consentService.createConsent(consentData);
      
      // Verify blockchain transaction
      await this.consentService.verifyBlockchainTransaction(
        createdConsent.blockchainTxId
      );

      return createdConsent;
    });
  }

  /**
   * Handle consent status updates with blockchain verification
   */
  private async handleUpdateConsent(job: Job<ConsentJobData>): Promise<void> {
    const { consentData, metadata } = job.data;

    await this.blockchainBreaker.fire(async () => {
      const updatedConsent = await this.consentService.updateConsentStatus(
        consentData.id,
        consentData.status
      );

      // Verify blockchain transaction
      await this.consentService.verifyBlockchainTransaction(
        updatedConsent.blockchainTxId
      );

      return updatedConsent;
    });
  }

  /**
   * Handle consent revocation with blockchain recording
   */
  private async handleRevokeConsent(job: Job<ConsentJobData>): Promise<void> {
    const { consentData, metadata } = job.data;

    await this.blockchainBreaker.fire(async () => {
      const revokedConsent = await this.consentService.revokeConsent(
        consentData.id
      );

      // Verify blockchain transaction
      await this.consentService.verifyBlockchainTransaction(
        revokedConsent.blockchainTxId
      );

      return revokedConsent;
    });
  }

  /**
   * Validate job data including HIPAA compliance
   */
  private async validateJobData(jobData: ConsentJobData): Promise<void> {
    // Validate HIPAA compliance
    if (!jobData.metadata.hipaaCompliant) {
      throw new Error('Job data does not meet HIPAA compliance requirements');
    }

    // Validate consent data structure
    const validationResult: FHIRValidationResult = await validateFHIRResource(
      jobData.consentData as any,
      { validateHIPAA: true }
    );

    if (!validationResult.valid) {
      throw new Error(
        `Consent validation failed: ${validationResult.errors[0]?.message}`
      );
    }
  }

  /**
   * Configure circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.blockchainBreaker.on('open', () => {
      this.logger.warn({
        message: 'Blockchain circuit breaker opened',
        timestamp: new Date().toISOString()
      });
    });

    this.blockchainBreaker.on('halfOpen', () => {
      this.logger.log({
        message: 'Blockchain circuit breaker half-opened',
        timestamp: new Date().toISOString()
      });
    });

    this.blockchainBreaker.on('close', () => {
      this.logger.log({
        message: 'Blockchain circuit breaker closed',
        timestamp: new Date().toISOString()
      });
    });

    this.blockchainBreaker.on('fallback', () => {
      this.logger.error({
        message: 'Blockchain operation fallback triggered',
        timestamp: new Date().toISOString()
      });
    });
  }
}

export default ConsentProcessor;