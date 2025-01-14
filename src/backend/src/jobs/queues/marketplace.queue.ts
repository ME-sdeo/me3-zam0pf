/**
 * @file Marketplace queue implementation for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements a Bull queue for handling asynchronous marketplace operations
 * with enhanced security, HIPAA compliance, and robust error handling
 */

import Queue, { Job, QueueScheduler } from 'bull'; // bull@^4.10.0
import { queueConfig, QUEUE_NAMES } from '../../config/queue.config';
import { logger } from '../../utils/logger.util';
import { ErrorCode } from '../../constants/error.constants';

/**
 * Interface for job data validation
 */
interface MarketplaceJobData {
  requestId: string;
  userId?: string;
  companyId?: string;
  dataType: 'request' | 'match' | 'transaction';
  payload: Record<string, any>;
}

/**
 * Interface for security context tracking
 */
interface SecurityContext {
  userId: string;
  ipAddress: string;
  action: string;
  hipaaRelevant: boolean;
  auditRequired: boolean;
}

/**
 * Marketplace queue instance with enhanced security and monitoring
 */
const marketplaceQueue = new Queue<MarketplaceJobData>(
  QUEUE_NAMES.MARKETPLACE,
  {
    connection: queueConfig.connection,
    defaultJobOptions: {
      ...queueConfig.defaultJobOptions,
      priority: queueConfig.queues.marketplace.priority,
      attempts: queueConfig.queues.marketplace.attempts,
      backoff: queueConfig.queues.marketplace.backoff,
      removeOnComplete: {
        age: 86400, // 24 hours retention for completed jobs
        count: 1000
      },
      removeOnFail: {
        age: 604800 // 7 days retention for failed jobs
      }
    }
  }
);

/**
 * Queue scheduler for handling delayed and recurring jobs
 */
const scheduler = new QueueScheduler(QUEUE_NAMES.MARKETPLACE, {
  connection: queueConfig.connection
});

/**
 * Validates job data against schema requirements
 * @param jobData - Data to be validated
 * @throws Error if validation fails
 */
const validateJobData = (jobData: MarketplaceJobData): void => {
  if (!jobData.requestId || !jobData.dataType || !jobData.payload) {
    throw new Error('Invalid job data: Missing required fields');
  }

  const validDataTypes = ['request', 'match', 'transaction'];
  if (!validDataTypes.includes(jobData.dataType)) {
    throw new Error('Invalid job data: Unsupported data type');
  }
};

/**
 * Adds a new job to the marketplace queue with enhanced security
 * @param jobData - Data for the job
 * @param options - Job options
 * @param securityContext - Security context for tracking
 * @returns Created job instance
 */
const addJob = async (
  jobData: MarketplaceJobData,
  options: Partial<Queue.JobOptions> = {},
  securityContext: SecurityContext
): Promise<Job<MarketplaceJobData>> => {
  try {
    // Validate job data
    validateJobData(jobData);

    // Log job creation attempt with security context
    logger.info('Adding marketplace job', {
      requestId: jobData.requestId,
      dataType: jobData.dataType,
      ...securityContext
    });

    // Add job with security metadata
    const job = await marketplaceQueue.add(jobData, {
      ...options,
      jobId: `${jobData.dataType}-${jobData.requestId}`,
      timestamp: Date.now(),
      metadata: {
        securityContext,
        hipaaRelevant: securityContext.hipaaRelevant,
        auditRequired: securityContext.auditRequired
      }
    });

    // Log successful job creation
    logger.info('Marketplace job added successfully', {
      jobId: job.id,
      requestId: jobData.requestId,
      ...securityContext
    });

    return job;
  } catch (error) {
    logger.error('Failed to add marketplace job', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: jobData.requestId,
      ...securityContext
    });
    throw error;
  }
};

/**
 * Removes a job from the marketplace queue with audit logging
 * @param jobId - ID of the job to remove
 * @param securityContext - Security context for tracking
 */
const removeJob = async (
  jobId: string,
  securityContext: SecurityContext
): Promise<void> => {
  try {
    // Log removal attempt
    logger.info('Removing marketplace job', {
      jobId,
      ...securityContext
    });

    // Check job existence
    const job = await marketplaceQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Remove job
    await job.remove();

    // Log successful removal with audit trail
    logger.audit('Marketplace job removed', {
      jobId,
      ...securityContext
    });
  } catch (error) {
    logger.error('Failed to remove marketplace job', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jobId,
      ...securityContext
    });
    throw error;
  }
};

/**
 * Gets the status of a marketplace job
 * @param jobId - ID of the job
 * @returns Job status information
 */
const getJobStatus = async (jobId: string): Promise<{
  status: string;
  progress: number;
  attempts: number;
}> => {
  const job = await marketplaceQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const state = await job.getState();
  return {
    status: state,
    progress: job.progress(),
    attempts: job.attemptsMade
  };
};

/**
 * Pauses the marketplace queue processing
 */
const pauseProcessing = async (): Promise<void> => {
  await marketplaceQueue.pause();
  logger.info('Marketplace queue processing paused');
};

/**
 * Resumes the marketplace queue processing
 */
const resumeProcessing = async (): Promise<void> => {
  await marketplaceQueue.resume();
  logger.info('Marketplace queue processing resumed');
};

// Error handling for the queue
marketplaceQueue.on('error', (error: Error) => {
  logger.error('Marketplace queue error', {
    error: error.message,
    code: ErrorCode.SYS_001
  });
});

marketplaceQueue.on('failed', (job: Job, error: Error) => {
  logger.error('Marketplace job failed', {
    jobId: job.id,
    error: error.message,
    attempts: job.attemptsMade,
    metadata: job.opts.metadata
  });
});

// Export queue instance and operations
export const marketplaceQueueOperations = {
  addJob,
  removeJob,
  getJobStatus,
  pauseProcessing,
  resumeProcessing
};

export default marketplaceQueue;