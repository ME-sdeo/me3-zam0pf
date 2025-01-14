/**
 * @file HIPAA-compliant notification processor for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Secure processor implementation for handling notification jobs with comprehensive audit logging
 */

import { Job } from 'bull'; // ^4.10.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { SecurityContext } from '@myelixir/security'; // ^1.0.0
import { NotificationQueue } from '../queues/notification.queue';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger.util';

// Constants for processor configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 300000; // 5 minutes
const RATE_LIMIT_PER_MINUTE = 100;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
const AUDIT_LOG_RETENTION_DAYS = 2555; // 7 years for HIPAA compliance

/**
 * Interface for notification job data with HIPAA-compliant fields
 */
interface NotificationJobData {
  type: 'consumer-request' | 'data-shared' | 'company-request-met';
  recipientId: string;
  metadata: {
    correlationId: string;
    resourceType?: string;
    requestId?: string;
    timestamp: string;
    hipaaRelevant: boolean;
  };
  content: {
    title: string;
    message: string;
    data?: Record<string, unknown>;
  };
}

/**
 * HIPAA-compliant notification processor with security context tracking
 */
export class NotificationProcessor {
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationQueue: NotificationQueue,
    private readonly securityContext: SecurityContext
  ) {
    // Initialize circuit breaker for external service calls
    this.circuitBreaker = new CircuitBreaker(this.processJob.bind(this), {
      timeout: CIRCUIT_BREAKER_TIMEOUT,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();

    // Register job processor with security context
    this.notificationQueue.onProcess(this.processWithSecurity.bind(this));
  }

  /**
   * Process notification job with security context and audit logging
   * @param job Bull queue job containing notification data
   */
  private async processWithSecurity(job: Job<NotificationJobData>): Promise<void> {
    try {
      // Validate security context
      await this.securityContext.validate({
        operation: 'notification.process',
        resourceId: job.data.recipientId,
        metadata: {
          jobId: job.id,
          correlationId: job.data.metadata.correlationId
        }
      });

      // Start audit trail
      logger.audit('Starting notification processing', {
        jobId: job.id,
        type: job.data.type,
        recipientId: job.data.recipientId,
        correlationId: job.data.metadata.correlationId,
        hipaaRelevant: job.data.metadata.hipaaRelevant
      });

      // Process job through circuit breaker
      await this.circuitBreaker.fire(job);

      // Complete audit trail
      logger.audit('Notification processing completed', {
        jobId: job.id,
        type: job.data.type,
        status: 'completed',
        correlationId: job.data.metadata.correlationId
      });
    } catch (error) {
      await this.handleError(error, job);
    }
  }

  /**
   * Process different types of notifications with HIPAA compliance
   * @param job Notification job to process
   */
  private async processJob(job: Job<NotificationJobData>): Promise<void> {
    const { data } = job;

    switch (data.type) {
      case 'consumer-request':
        await this.notificationService.sendConsumerRequestNotification(
          data.recipientId,
          data.content.data as any
        );
        break;

      case 'data-shared':
        await this.notificationService.sendDataSharedNotification(
          data.recipientId,
          data.content.data as any
        );
        break;

      case 'company-request-met':
        await this.notificationService.sendCompanyRequestNotification(
          data.recipientId,
          data.content.data as any
        );
        break;

      default:
        throw new Error(`Unsupported notification type: ${data.type}`);
    }
  }

  /**
   * Handle errors with comprehensive logging and retry logic
   * @param error Error that occurred during processing
   * @param job Failed job instance
   */
  private async handleError(error: unknown, job: Job<NotificationJobData>): Promise<void> {
    // Log error with security context
    logger.error('Notification processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jobId: job.id,
      type: job.data.type,
      recipientId: job.data.recipientId,
      correlationId: job.data.metadata.correlationId,
      attempt: job.attemptsMade
    });

    // Record in audit log
    logger.audit('Notification processing error', {
      jobId: job.id,
      type: job.data.type,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: job.data.metadata.correlationId
    });

    // Determine if job should be retried
    if (job.attemptsMade < MAX_RETRIES) {
      await job.retry({
        delay: RETRY_DELAY
      });
    } else {
      // Mark job as failed after max retries
      await job.moveToFailed(
        {
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        true
      );
    }
  }

  /**
   * Set up circuit breaker event handlers with logging
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      logger.error('Notification circuit breaker opened', {
        timestamp: new Date().toISOString()
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Notification circuit breaker half-opened', {
        timestamp: new Date().toISOString()
      });
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Notification circuit breaker closed', {
        timestamp: new Date().toISOString()
      });
    });
  }
}