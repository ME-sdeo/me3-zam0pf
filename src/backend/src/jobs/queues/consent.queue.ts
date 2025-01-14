/**
 * HIPAA-compliant consent queue implementation for MyElixir healthcare data marketplace
 * @version 1.0.0
 */

import { Queue, QueueOptions } from 'bull'; // ^4.10.0
import { Logger } from '@nestjs/common'; // ^8.0.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { IConsent, ConsentStatus } from '../../interfaces/consent.interface';
import { ConsentService } from '../../services/consent.service';
import { validateFHIRResource } from '../../utils/validation.util';
import { UUID } from 'crypto';

/**
 * Interface for HIPAA-compliant consent job data
 */
interface ConsentJobData {
  consentId: UUID;
  userId: UUID;
  companyId: UUID;
  requestId: UUID;
  action: ConsentJobAction;
  blockchainRef?: string;
  auditTrail: AuditInfo;
  hipaaCompliance: ComplianceInfo;
}

/**
 * Interface for audit trail information
 */
interface AuditInfo {
  timestamp: Date;
  actor: string;
  action: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for HIPAA compliance information
 */
interface ComplianceInfo {
  hipaaCompliant: boolean;
  gdprCompliant: boolean;
  dataEncrypted: boolean;
  validationTimestamp: Date;
}

/**
 * Enum for consent job actions with audit tracking
 */
enum ConsentJobAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  REVOKE = 'REVOKE',
  VALIDATE = 'VALIDATE',
  BLOCKCHAIN_RECORD = 'BLOCKCHAIN_RECORD'
}

/**
 * Constants for queue configuration
 */
const CONSENT_QUEUE_NAME = 'hipaa-consent-queue';
const CONSENT_QUEUE_OPTIONS: QueueOptions = {
  defaultJobOptions: {
    priority: 'high',
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    timeout: 30000
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production',
    maxRetriesPerRequest: 3
  },
  metrics: {
    collect: true,
    prefix: 'myelixir_consent'
  }
};

/**
 * Creates and configures a HIPAA-compliant consent processing queue
 */
export const createConsentQueue = (
  consentService: ConsentService,
  options: QueueOptions = CONSENT_QUEUE_OPTIONS,
  circuitBreaker: CircuitBreaker
): Queue<ConsentJobData> => {
  const logger = new Logger('ConsentQueue');
  const queue = new Queue<ConsentJobData>(CONSENT_QUEUE_NAME, options);

  // Configure queue error handling
  queue.on('error', (error) => {
    logger.error('Consent queue error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });

  // Configure queue monitoring
  queue.on('waiting', (jobId) => {
    logger.debug(`Job ${jobId} is waiting`);
  });

  queue.on('active', (job) => {
    logger.debug(`Processing job ${job.id}`, {
      action: job.data.action,
      timestamp: new Date().toISOString()
    });
  });

  queue.on('completed', (job) => {
    logger.debug(`Completed job ${job.id}`, {
      action: job.data.action,
      timestamp: new Date().toISOString()
    });
  });

  queue.on('failed', (job, error) => {
    logger.error(`Failed job ${job?.id}`, {
      action: job?.data.action,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });

  // Configure job processor with circuit breaker
  queue.process(async (job) => {
    return circuitBreaker.fire(async () => processConsentJob(job, consentService, logger));
  });

  return queue;
};

/**
 * Processes consent jobs with HIPAA compliance and blockchain recording
 */
async function processConsentJob(
  job: Queue.Job<ConsentJobData>,
  consentService: ConsentService,
  logger: Logger
): Promise<void> {
  const { data } = job;
  logger.log(`Processing consent job: ${job.id}`, {
    action: data.action,
    consentId: data.consentId,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate HIPAA compliance
    const validationResult = await validateFHIRResource({
      resourceType: 'Consent',
      id: data.consentId,
      status: ConsentStatus.PENDING
    });

    if (!validationResult.valid) {
      throw new Error(`HIPAA validation failed: ${validationResult.errors[0].message}`);
    }

    // Process based on action type
    switch (data.action) {
      case ConsentJobAction.CREATE:
        await consentService.createConsent({
          id: data.consentId,
          userId: data.userId,
          companyId: data.companyId,
          requestId: data.requestId,
          status: ConsentStatus.PENDING
        } as IConsent);
        break;

      case ConsentJobAction.UPDATE:
        await consentService.updateConsentStatus(
          data.consentId,
          ConsentStatus.ACTIVE
        );
        break;

      case ConsentJobAction.REVOKE:
        await consentService.updateConsentStatus(
          data.consentId,
          ConsentStatus.REVOKED
        );
        break;

      case ConsentJobAction.BLOCKCHAIN_RECORD:
        if (data.blockchainRef) {
          await consentService.recordBlockchainTransaction(
            data.consentId,
            data.blockchainRef
          );
        }
        break;

      default:
        throw new Error(`Unsupported consent action: ${data.action}`);
    }

    // Update job progress
    await job.progress(100);

    logger.log(`Successfully processed consent job: ${job.id}`, {
      action: data.action,
      consentId: data.consentId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error processing consent job: ${job.id}`, {
      action: data.action,
      consentId: data.consentId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Export types and functions
export {
  ConsentJobData,
  ConsentJobAction,
  AuditInfo,
  ComplianceInfo,
  CONSENT_QUEUE_NAME,
  CONSENT_QUEUE_OPTIONS
};