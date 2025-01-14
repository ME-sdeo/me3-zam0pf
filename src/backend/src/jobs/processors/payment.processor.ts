import { Job } from 'bull'; // ^4.10.0
import { Logger } from 'winston'; // ^3.8.2
import { injectable, inject } from 'inversify'; // ^6.0.1
import { PaymentService } from '../../services/payment.service';
import { PaymentJobData } from '../queues/payment.queue';
import { PaymentTransaction, ComplianceLevel } from '../../types/payment.types';
import { TransactionStatus } from '../../types/marketplace.types';
import { BlockchainTransaction, TransactionType } from '../../types/blockchain.types';

// Constants for payment processing
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000;
const PAYMENT_TIMEOUT = 300000; // 5 minutes
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 transactions per minute
const COMPLIANCE_CHECK_TIMEOUT = 30000; // 30 seconds

/**
 * HIPAA/GDPR-compliant payment processor for handling secure payment transactions
 */
@injectable()
export class PaymentProcessor {
    constructor(
        @inject('PaymentService') private paymentService: PaymentService,
        @inject('Logger') private logger: Logger,
        @inject('RateLimiter') private rateLimiter: any,
        @inject('ComplianceValidator') private complianceValidator: any
    ) {}

    /**
     * Processes payment jobs with comprehensive security and compliance checks
     * @param job Bull queue job containing payment data
     * @returns Processed payment transaction with compliance status
     */
    public async process(job: Job<PaymentJobData>): Promise<PaymentTransaction> {
        try {
            // Validate security context
            this.validateSecurityContext(job.data.securityContext);

            // Check rate limits
            await this.checkRateLimits(job.data.paymentId);

            // Log processing initiation
            this.logger.info('Payment processing initiated', {
                paymentId: job.data.paymentId,
                requestId: job.data.requestId,
                timestamp: new Date().toISOString()
            });

            // Validate compliance requirements
            await this.validateCompliance(job.data);

            // Process payment with security context
            const transaction = await this.processPaymentWithRetry(job);

            // Record transaction on blockchain
            const blockchainRecord = await this.recordBlockchainTransaction(transaction);

            // Update transaction with blockchain reference
            const finalTransaction = await this.updateTransactionStatus(
                transaction,
                blockchainRecord
            );

            // Log successful processing
            this.logger.info('Payment processed successfully', {
                transactionId: finalTransaction.id,
                blockchainRef: finalTransaction.blockchainRef,
                timestamp: new Date().toISOString()
            });

            return finalTransaction;

        } catch (error) {
            await this.handleProcessingError(error, job);
            throw error;
        }
    }

    /**
     * Validates security context for payment processing
     */
    private validateSecurityContext(securityContext: any): void {
        if (!securityContext || !securityContext.encryptionLevel) {
            throw new Error('Invalid security context for payment processing');
        }

        // Validate encryption level
        if (securityContext.encryptionLevel !== 'AES-256-GCM') {
            throw new Error('Unsupported encryption level');
        }

        // Validate IP and user agent
        if (!securityContext.ipAddress || !securityContext.userAgent) {
            throw new Error('Missing security context details');
        }
    }

    /**
     * Enforces rate limiting for payment processing
     */
    private async checkRateLimits(paymentId: string): Promise<void> {
        const rateLimitResult = await this.rateLimiter.checkLimit({
            key: paymentId,
            window: RATE_LIMIT_WINDOW,
            limit: RATE_LIMIT_MAX
        });

        if (!rateLimitResult.allowed) {
            throw new Error('Rate limit exceeded for payment processing');
        }
    }

    /**
     * Validates HIPAA/GDPR compliance requirements
     */
    private async validateCompliance(jobData: PaymentJobData): Promise<void> {
        const complianceResult = await this.complianceValidator.validate({
            paymentId: jobData.paymentId,
            amount: jobData.amount,
            securityContext: jobData.securityContext,
            complianceMetadata: jobData.complianceMetadata
        });

        if (!complianceResult.isCompliant) {
            throw new Error(`Compliance validation failed: ${complianceResult.reason}`);
        }
    }

    /**
     * Processes payment with retry mechanism
     */
    private async processPaymentWithRetry(job: Job<PaymentJobData>): Promise<PaymentTransaction> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return await this.paymentService.processPayment(
                    job.data.paymentId,
                    job.data.requestId,
                    {
                        networkId: 'myElixir',
                        channelName: 'consentchannel',
                        chaincodeName: 'consentcontract',
                        transactionType: TransactionType.PAYMENT_PROCESSED
                    }
                );
            } catch (error) {
                lastError = error as Error;
                this.logger.warn(`Payment attempt ${attempt} failed`, {
                    paymentId: job.data.paymentId,
                    error: error.message,
                    attempt
                });

                if (attempt < MAX_RETRY_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                }
            }
        }

        throw lastError || new Error('Payment processing failed after maximum retries');
    }

    /**
     * Records transaction on blockchain with compliance metadata
     */
    private async recordBlockchainTransaction(
        transaction: PaymentTransaction
    ): Promise<BlockchainTransaction> {
        return await this.paymentService.recordBlockchainTransaction(
            transaction,
            {
                networkId: 'myElixir',
                channelName: 'consentchannel',
                chaincodeName: 'consentcontract',
                transactionType: TransactionType.PAYMENT_PROCESSED
            }
        );
    }

    /**
     * Updates transaction status with blockchain reference
     */
    private async updateTransactionStatus(
        transaction: PaymentTransaction,
        blockchainRecord: BlockchainTransaction
    ): Promise<PaymentTransaction> {
        return {
            ...transaction,
            status: TransactionStatus.COMPLETED,
            blockchainRef: blockchainRecord.transactionId,
            complianceLevel: ComplianceLevel.HIPAA,
            updatedAt: new Date()
        };
    }

    /**
     * Handles payment processing errors with security logging
     */
    private async handleProcessingError(error: Error, job: Job<PaymentJobData>): Promise<void> {
        this.logger.error('Payment processing failed', {
            paymentId: job.data.paymentId,
            error: error.message,
            securityContext: job.data.securityContext,
            timestamp: new Date().toISOString()
        });

        // Attempt refund if payment was initiated
        if (job.data.paymentId) {
            try {
                await this.paymentService.refundPayment(
                    job.data.paymentId,
                    'Processing error',
                    job.data.amount,
                    {
                        hipaaRequired: true,
                        gdprRequired: true,
                        hitechRequired: true,
                        auditTrailRequired: true,
                        retentionPeriodDays: 2555 // 7 years
                    }
                );
            } catch (refundError) {
                this.logger.error('Refund failed', {
                    paymentId: job.data.paymentId,
                    error: refundError.message
                });
            }
        }
    }
}

export default PaymentProcessor;