/**
 * @file Secure, HIPAA-compliant notification queue implementation for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements a Bull queue for handling asynchronous notifications with comprehensive security,
 * error handling, rate limiting, and audit logging capabilities
 */

import Queue, { Job, JobOptions } from 'bull'; // bull@^4.10.0
import { EventEmitter } from 'events';
import { queueConfig, QUEUE_NAMES } from '../../config/queue.config';
import { logger } from '../../utils/logger.util';
import { ErrorCode, getErrorMessage } from '../../constants/error.constants';

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
 * Rate limiter configuration for notification processing
 */
interface RateLimiterConfig {
  maxTransactions: number;
  timeWindow: number; // in milliseconds
  currentCount: number;
  lastReset: number;
}

/**
 * HIPAA-compliant notification queue implementation
 */
export class NotificationQueue {
  private queue: Queue.Queue<NotificationJobData>;
  private eventEmitter: EventEmitter;
  private rateLimiter: RateLimiterConfig;
  private readonly QUEUE_OPTIONS: JobOptions;

  constructor() {
    // Initialize queue with secure configuration
    this.queue = new Queue<NotificationJobData>(
      QUEUE_NAMES.NOTIFICATION,
      {
        redis: queueConfig.connection,
        defaultJobOptions: {
          ...queueConfig.defaultJobOptions,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 300000 // 5 minutes
          },
          removeOnComplete: {
            age: 86400, // 24 hours
            count: 1000
          }
        }
      }
    );

    // Initialize event emitter for decoupled processing
    this.eventEmitter = new EventEmitter();

    // Configure rate limiter
    this.rateLimiter = {
      maxTransactions: 100,
      timeWindow: 60000, // 1 minute
      currentCount: 0,
      lastReset: Date.now()
    };

    // Set up error handlers with audit logging
    this.setupErrorHandlers();
    
    // Initialize queue monitoring
    this.setupQueueMonitoring();
  }

  /**
   * Adds a new notification job to the queue with security validation
   * @param data - Notification job data
   * @returns Promise resolving to the created job
   */
  public async addJob(data: NotificationJobData): Promise<Job<NotificationJobData>> {
    try {
      // Validate rate limits
      if (!this.checkRateLimit()) {
        throw new Error(getErrorMessage(ErrorCode.SYS_001));
      }

      // Add audit metadata
      const jobData: NotificationJobData = {
        ...data,
        metadata: {
          ...data.metadata,
          timestamp: new Date().toISOString(),
          correlationId: data.metadata.correlationId || crypto.randomUUID()
        }
      };

      // Add job to queue with security context
      const job = await this.queue.add(jobData, {
        priority: 2, // Medium priority
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 300000 // 5 minutes
        }
      });

      // Log job creation with secure context
      logger.info('Notification job created', {
        jobId: job.id,
        type: data.type,
        recipientId: data.recipientId,
        correlationId: jobData.metadata.correlationId,
        hipaaRelevant: data.metadata.hipaaRelevant
      });

      return job;
    } catch (error) {
      logger.error('Failed to create notification job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: data.type,
        recipientId: data.recipientId
      });
      throw error;
    }
  }

  /**
   * Removes a job from the queue with audit logging
   * @param jobId - ID of the job to remove
   */
  public async removeJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info('Notification job removed', {
          jobId,
          type: job.data.type,
          recipientId: job.data.recipientId
        });
      }
    } catch (error) {
      logger.error('Failed to remove notification job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Registers a secure handler for processing notification jobs
   * @param handler - Function to process notification jobs
   */
  public onProcess(
    handler: (job: Job<NotificationJobData>) => Promise<void>
  ): void {
    this.queue.process(async (job) => {
      try {
        // Emit processing event for monitoring
        this.eventEmitter.emit('processing', {
          jobId: job.id,
          type: job.data.type,
          timestamp: Date.now()
        });

        await handler(job);

        // Log successful processing
        logger.info('Notification job processed', {
          jobId: job.id,
          type: job.data.type,
          recipientId: job.data.recipientId,
          correlationId: job.data.metadata.correlationId
        });
      } catch (error) {
        // Log processing failure with secure context
        logger.error('Notification job processing failed', {
          jobId: job.id,
          type: job.data.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId: job.data.metadata.correlationId
        });
        throw error;
      }
    });
  }

  /**
   * Sets up error handlers for the queue
   */
  private setupErrorHandlers(): void {
    this.queue.on('error', (error) => {
      logger.error('Notification queue error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.queue.on('failed', (job, error) => {
      logger.error('Notification job failed', {
        jobId: job.id,
        type: job.data.type,
        error: error.message,
        attempts: job.attemptsMade,
        correlationId: job.data.metadata.correlationId
      });
    });
  }

  /**
   * Sets up queue monitoring and metrics collection
   */
  private setupQueueMonitoring(): void {
    this.queue.on('completed', (job) => {
      logger.info('Notification job completed', {
        jobId: job.id,
        type: job.data.type,
        processingTime: Date.now() - job.timestamp,
        correlationId: job.data.metadata.correlationId
      });
    });

    // Monitor queue health
    setInterval(async () => {
      const metrics = await this.queue.getMetrics();
      logger.info('Notification queue metrics', {
        waiting: metrics.waiting,
        active: metrics.active,
        completed: metrics.completed,
        failed: metrics.failed,
        delayed: metrics.delayed
      });
    }, 300000); // Every 5 minutes
  }

  /**
   * Checks if current operation is within rate limits
   * @returns boolean indicating if operation is allowed
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.rateLimiter.lastReset >= this.rateLimiter.timeWindow) {
      this.rateLimiter.currentCount = 0;
      this.rateLimiter.lastReset = now;
    }

    if (this.rateLimiter.currentCount >= this.rateLimiter.maxTransactions) {
      return false;
    }

    this.rateLimiter.currentCount++;
    return true;
  }
}