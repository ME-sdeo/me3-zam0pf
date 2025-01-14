/**
 * HIPAA-compliant marketplace processor for handling background jobs
 * @version 1.0.0
 */

import { Job, DoneCallback } from 'bull';
import { CircuitBreaker } from 'opossum';
import { Metrics } from '@opentelemetry/metrics';
import { MarketplaceService } from '../../services/marketplace.service';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger.util';
import { DataRequest, RequestStatus, DataMatch } from '../../interfaces/marketplace.interface';
import { ErrorCode, getErrorMessage } from '../../constants/error.constants';

// Constants for processor configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 1000;

/**
 * HIPAA-compliant marketplace processor implementation
 */
export class MarketplaceProcessor {
  private readonly circuitBreaker: CircuitBreaker;
  private processingMetrics: Metrics;

  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly notificationService: NotificationService
  ) {
    // Initialize circuit breaker for fault tolerance
    this.circuitBreaker = new CircuitBreaker(this.processDataRequest.bind(this), {
      timeout: 30000, // 30 seconds
      resetTimeout: 60000, // 1 minute
      errorThresholdPercentage: 50,
      volumeThreshold: CIRCUIT_BREAKER_THRESHOLD
    });

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Main processor function for marketplace jobs
   * @param job Bull job containing request data
   * @param done Callback to mark job completion
   */
  public async process(job: Job<DataRequest>, done: DoneCallback): Promise<void> {
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
      logger.info('Starting marketplace job processing', {
        jobId: job.id,
        requestId: job.data.id,
        correlationId,
        timestamp: new Date().toISOString()
      });

      // Validate job data
      await this.validateJobData(job.data);

      // Process request through circuit breaker
      const result = await this.circuitBreaker.fire(job);

      // Update metrics
      this.updateProcessingMetrics(startTime, true);

      logger.info('Marketplace job processed successfully', {
        jobId: job.id,
        requestId: job.data.id,
        correlationId,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      done(null, result);
    } catch (error) {
      await this.handleProcessingError(error, job, correlationId);
      done(error as Error);
    }
  }

  /**
   * Processes data request with HIPAA compliance
   * @param job Bull job containing request data
   */
  private async processDataRequest(job: Job<DataRequest>): Promise<void> {
    const { data: request } = job;

    // Find matching records
    const matches = await this.marketplaceService.findMatchingRecords(request.id);

    // Process matches and verify compliance
    const validMatches = await this.processMatches(matches, request);

    if (validMatches.length > 0) {
      // Process marketplace transaction
      await this.marketplaceService.processTransaction(
        request.id,
        validMatches[0].resourceId,
        validMatches.map(match => match.resourceId)
      );

      // Send notifications
      await this.sendNotifications(request, validMatches);
    }

    // Update request status
    await this.marketplaceService.validateRequest(request.id, 
      validMatches.length > 0 ? RequestStatus.COMPLETED : RequestStatus.EXPIRED
    );
  }

  /**
   * Processes and validates matches with HIPAA compliance
   * @param matches Array of potential matches
   * @param request Original data request
   */
  private async processMatches(
    matches: DataMatch[],
    request: DataRequest
  ): Promise<DataMatch[]> {
    return matches.filter(match => {
      // Verify match score meets threshold
      if (match.score < 0.85) return false;

      // Verify compliance status
      if (!match.complianceVerification) return false;

      // Verify consent status
      if (match.consentStatus !== 'VALID') return false;

      return true;
    });
  }

  /**
   * Sends notifications to relevant parties
   * @param request Data request
   * @param matches Valid matches
   */
  private async sendNotifications(
    request: DataRequest,
    matches: DataMatch[]
  ): Promise<void> {
    try {
      // Notify data providers
      for (const match of matches) {
        await this.notificationService.sendConsumerRequestNotification(
          match.resourceId,
          {
            requestId: request.id,
            companyName: request.companyId,
            dataType: request.filterCriteria.resourceTypes.join(', '),
            compensation: request.pricePerRecord
          }
        );
      }

      // Notify requesting company
      await this.notificationService.sendCompanyRequestNotification(
        request.companyId,
        {
          requestId: request.id,
          dataType: request.filterCriteria.resourceTypes.join(', '),
          recordCount: matches.length,
          totalCost: matches.length * request.pricePerRecord
        }
      );
    } catch (error) {
      logger.error('Failed to send notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: request.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validates job data before processing
   * @param data Job data to validate
   */
  private async validateJobData(data: DataRequest): Promise<void> {
    if (!data.id || !data.companyId || !data.filterCriteria) {
      throw new Error(getErrorMessage(ErrorCode.FHIR_001));
    }

    // Validate FHIR compliance
    const validationResult = await this.marketplaceService.validateRequest(data.id);
    if (!validationResult.valid) {
      throw new Error(getErrorMessage(ErrorCode.FHIR_001));
    }
  }

  /**
   * Handles processing errors with comprehensive logging
   * @param error Error that occurred
   * @param job Failed job
   * @param correlationId Correlation ID for tracking
   */
  private async handleProcessingError(
    error: unknown,
    job: Job<DataRequest>,
    correlationId: string
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Marketplace job processing failed', {
      jobId: job.id,
      requestId: job.data.id,
      error: errorMessage,
      correlationId,
      timestamp: new Date().toISOString()
    });

    // Update metrics
    this.updateProcessingMetrics(Date.now(), false);

    // Notify relevant parties of failure
    await this.notificationService.sendErrorNotification(
      job.data.companyId,
      {
        requestId: job.data.id,
        error: errorMessage
      }
    );
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      logger.warn('Circuit breaker opened', {
        timestamp: new Date().toISOString()
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open', {
        timestamp: new Date().toISOString()
      });
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Circuit breaker closed', {
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Updates processing metrics
   * @param startTime Processing start time
   * @param success Whether processing was successful
   */
  private updateProcessingMetrics(startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;
    
    this.processingMetrics.record({
      name: 'marketplace_processing_duration',
      value: duration,
      labels: { success: success.toString() }
    });

    if (success) {
      this.processingMetrics.record({
        name: 'marketplace_processing_success',
        value: 1
      });
    } else {
      this.processingMetrics.record({
        name: 'marketplace_processing_failure',
        value: 1
      });
    }
  }
}

export default MarketplaceProcessor;