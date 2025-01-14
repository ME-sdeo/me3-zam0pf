import { Queue, Job } from 'bull'; // bull@^4.10.0
import { logger } from 'winston'; // winston@^3.8.0
import Stripe from 'stripe'; // stripe@^12.0.0
import rateLimit from 'express-rate-limit'; // express-rate-limit@^6.7.0
import { BlockchainService } from '@blockchain/service'; // @blockchain/service@^1.0.0
import { ComplianceService } from '@healthcare/compliance-service'; // @healthcare/compliance-service@^1.0.0
import { queueConfig, QUEUE_NAMES } from '../../config/queue.config';

interface SecurityContext {
  encryptionType: string;
  auditLevel: string;
  complianceLevel: string;
}

interface ComplianceData {
  hipaaCompliant: boolean;
  gdprCompliant: boolean;
  dataUsageScope: string[];
}

interface PaymentAmount {
  amount: number;
  currency: string;
}

interface PaymentJobData {
  paymentId: string;
  amount: PaymentAmount;
  requestId: string;
  metadata: Record<string, any>;
  securityContext: SecurityContext;
  complianceData: ComplianceData;
}

interface PaymentTransaction {
  id: string;
  status: string;
  amount: PaymentAmount;
  blockchainRef: string;
  complianceVerified: boolean;
}

const QUEUE_OPTIONS = {
  priority: 1, // High priority
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000
  },
  removeOnFail: {
    age: 604800 // 7 days
  }
};

const RATE_LIMIT = {
  max: 100, // Maximum 100 transactions per minute
  duration: 60000,
  keyGenerator: (req: any) => req.paymentId,
  handler: (req: any) => {
    throw new Error('Rate limit exceeded for payment processing');
  }
};

const SECURITY_CONFIG = {
  encryption: 'AES-256-GCM',
  auditLevel: 'DETAILED',
  complianceCheck: 'STRICT'
};

export class PaymentQueue {
  private queue: Queue<PaymentJobData>;
  private stripeClient: Stripe;
  private blockchainService: BlockchainService;
  private complianceService: ComplianceService;
  private rateLimiter: any;

  constructor() {
    // Initialize queue with secure configuration
    this.queue = new Queue<PaymentJobData>(QUEUE_NAMES.PAYMENT, {
      ...queueConfig.connection,
      defaultJobOptions: QUEUE_OPTIONS
    });

    // Initialize external services
    this.stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
      typescript: true
    });
    
    this.blockchainService = new BlockchainService();
    this.complianceService = new ComplianceService();
    this.rateLimiter = rateLimit(RATE_LIMIT);

    // Configure queue processor
    this.queue.process(async (job: Job<PaymentJobData>) => {
      return this.processPayment(job.data);
    });

    // Error handling
    this.queue.on('error', (error: Error) => {
      logger.error('Payment queue error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Security monitoring
    this.queue.on('completed', (job: Job<PaymentJobData>) => {
      logger.info('Payment processed successfully:', {
        paymentId: job.data.paymentId,
        requestId: job.data.requestId,
        timestamp: new Date().toISOString()
      });
    });
  }

  async addJob(data: PaymentJobData): Promise<Job<PaymentJobData>> {
    // Validate security compliance
    if (!this.validateSecurityContext(data.securityContext)) {
      throw new Error('Invalid security context for payment processing');
    }

    // Check HIPAA/GDPR compliance
    const complianceResult = await this.complianceService.validateCompliance(data.complianceData);
    if (!complianceResult.isCompliant) {
      throw new Error(`Compliance validation failed: ${complianceResult.reason}`);
    }

    // Add security metadata
    const secureJobData = {
      ...data,
      metadata: {
        ...data.metadata,
        securityTimestamp: new Date().toISOString(),
        encryptionType: SECURITY_CONFIG.encryption,
        auditLevel: SECURITY_CONFIG.auditLevel
      }
    };

    // Add job to queue with high priority
    const job = await this.queue.add(secureJobData, {
      ...QUEUE_OPTIONS,
      jobId: data.paymentId
    });

    logger.info('Payment job created:', {
      paymentId: data.paymentId,
      requestId: data.requestId,
      timestamp: new Date().toISOString()
    });

    return job;
  }

  private async processPayment(data: PaymentJobData): Promise<PaymentTransaction> {
    // Validate security context
    if (!this.validateSecurityContext(data.securityContext)) {
      throw new Error('Security context validation failed');
    }

    // Check rate limits
    try {
      await this.rateLimiter({ paymentId: data.paymentId });
    } catch (error) {
      throw new Error('Rate limit exceeded for payment processing');
    }

    // Verify HIPAA compliance
    const complianceResult = await this.complianceService.validateCompliance(data.complianceData);
    if (!complianceResult.isCompliant) {
      throw new Error('Compliance validation failed during processing');
    }

    try {
      // Create Stripe payment intent
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: data.amount.amount,
        currency: data.amount.currency,
        metadata: {
          paymentId: data.paymentId,
          requestId: data.requestId,
          ...data.metadata
        }
      });

      // Record transaction in blockchain
      const blockchainRecord = await this.blockchainService.recordTransaction({
        transactionId: paymentIntent.id,
        paymentId: data.paymentId,
        requestId: data.requestId,
        amount: data.amount,
        timestamp: new Date().toISOString()
      });

      const transaction: PaymentTransaction = {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: data.amount,
        blockchainRef: blockchainRecord.hash,
        complianceVerified: true
      };

      logger.info('Payment processed successfully:', {
        paymentId: data.paymentId,
        transactionId: transaction.id,
        blockchainRef: transaction.blockchainRef,
        timestamp: new Date().toISOString()
      });

      return transaction;
    } catch (error) {
      logger.error('Payment processing failed:', {
        paymentId: data.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private validateSecurityContext(context: SecurityContext): boolean {
    return (
      context.encryptionType === SECURITY_CONFIG.encryption &&
      context.auditLevel === SECURITY_CONFIG.auditLevel &&
      context.complianceLevel === SECURITY_CONFIG.complianceCheck
    );
  }
}

export default PaymentQueue;