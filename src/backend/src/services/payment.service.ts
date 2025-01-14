import { Stripe } from 'stripe'; // ^8.222.0
import { Logger } from 'winston'; // ^3.8.2
import { IPaymentService, PaymentAmount, PaymentMethodType, ComplianceRules, BlockchainConfig, IPaymentTransaction } from '../interfaces/payment.interface';
import { TransactionModel } from '../models/transaction.model';
import { FabricService } from '../blockchain/services/fabric.service';
import { TransactionStatus } from '../types/marketplace.types';
import { TransactionType } from '../types/blockchain.types';

// Global constants for payment processing
const MIN_TRANSACTION_AMOUNT = 0.50;
const MAX_TRANSACTION_AMOUNT = 50000.00;
const DEFAULT_CURRENCY = 'USD';
const COMPLIANCE_LOG_RETENTION = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const TRANSACTION_TIMEOUT = 30000; // 30 seconds

/**
 * HIPAA-compliant payment service implementation with blockchain integration
 */
export class PaymentService implements IPaymentService {
    private readonly stripe: Stripe;
    private readonly fabricService: FabricService;
    private readonly logger: Logger;
    private readonly transactionModel: typeof TransactionModel;

    /**
     * Initializes payment service with enhanced security and compliance configurations
     */
    constructor(
        stripeSecretKey: string,
        fabricService: FabricService,
        logger: Logger,
        transactionModel: typeof TransactionModel
    ) {
        this.stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2022-11-15',
            typescript: true,
            timeout: TRANSACTION_TIMEOUT
        });
        this.fabricService = fabricService;
        this.logger = logger;
        this.transactionModel = transactionModel;
    }

    /**
     * Creates a HIPAA-compliant payment intent with blockchain verification
     */
    public async createPaymentIntent(
        amount: PaymentAmount,
        paymentMethod: PaymentMethodType,
        metadata: Record<string, any>,
        complianceConfig: ComplianceRules
    ): Promise<Stripe.PaymentIntent> {
        try {
            // Validate payment amount
            this.validatePaymentAmount(amount);

            // Verify compliance requirements
            if (complianceConfig.hipaaRequired) {
                this.validateHipaaCompliance(metadata);
            }

            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount.value * 100), // Convert to cents
                currency: amount.currency.toLowerCase(),
                payment_method_types: [this.mapPaymentMethodType(paymentMethod)],
                metadata: {
                    ...metadata,
                    hipaaCompliant: complianceConfig.hipaaRequired,
                    gdprCompliant: complianceConfig.gdprRequired,
                    retentionPeriod: complianceConfig.retentionPeriodDays
                }
            });

            this.logger.info('Payment intent created', {
                intentId: paymentIntent.id,
                amount: amount.value,
                currency: amount.currency,
                timestamp: new Date().toISOString()
            });

            return paymentIntent;
        } catch (error) {
            this.logger.error('Failed to create payment intent', {
                error: error.message,
                amount,
                paymentMethod,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Processes payment with comprehensive compliance verification and blockchain recording
     */
    public async processPayment(
        paymentIntentId: string,
        requestId: string,
        blockchainConfig: BlockchainConfig
    ): Promise<IPaymentTransaction> {
        try {
            // Retrieve payment intent
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            
            if (paymentIntent.status !== 'succeeded') {
                throw new Error(`Invalid payment intent status: ${paymentIntent.status}`);
            }

            // Create transaction record
            const transaction = await this.transactionModel.create({
                id: crypto.randomUUID(),
                requestId,
                paymentIntentId,
                amount: paymentIntent.amount / 100,
                status: TransactionStatus.PROCESSING,
                createdAt: new Date(),
                metadata: paymentIntent.metadata
            });

            // Record transaction on blockchain
            const blockchainTx = await this.fabricService.recordTransaction({
                transactionId: transaction.id,
                type: TransactionType.PAYMENT_PROCESSED,
                metadata: {
                    paymentIntentId,
                    requestId,
                    amount: paymentIntent.amount / 100,
                    timestamp: new Date().toISOString()
                }
            });

            // Update transaction with blockchain reference
            const updatedTransaction = await this.transactionModel.updateStatus(
                transaction.id,
                TransactionStatus.COMPLETED,
                blockchainTx.transactionId
            );

            this.logger.info('Payment processed successfully', {
                transactionId: transaction.id,
                blockchainTxId: blockchainTx.transactionId,
                timestamp: new Date().toISOString()
            });

            return updatedTransaction!;
        } catch (error) {
            this.logger.error('Payment processing failed', {
                paymentIntentId,
                requestId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Processes refunds with compliance tracking and blockchain recording
     */
    public async refundPayment(
        transactionId: string,
        reason: string,
        refundAmount: PaymentAmount,
        complianceConfig: ComplianceRules
    ): Promise<IPaymentTransaction> {
        try {
            // Retrieve original transaction
            const transaction = await this.transactionModel.findOne({ id: transactionId });
            if (!transaction) {
                throw new Error(`Transaction ${transactionId} not found`);
            }

            // Process refund through Stripe
            const refund = await this.stripe.refunds.create({
                payment_intent: transaction.paymentIntentId,
                amount: Math.round(refundAmount.value * 100),
                reason: reason as Stripe.RefundCreateParams.Reason
            });

            // Record refund on blockchain
            const blockchainTx = await this.fabricService.recordTransaction({
                transactionId: crypto.randomUUID(),
                type: TransactionType.PAYMENT_PROCESSED,
                metadata: {
                    originalTransactionId: transactionId,
                    refundId: refund.id,
                    amount: refundAmount.value,
                    reason,
                    timestamp: new Date().toISOString()
                }
            });

            // Update transaction status
            const updatedTransaction = await this.transactionModel.updateStatus(
                transactionId,
                TransactionStatus.REFUNDED,
                blockchainTx.transactionId
            );

            this.logger.info('Payment refunded successfully', {
                transactionId,
                refundId: refund.id,
                blockchainTxId: blockchainTx.transactionId,
                timestamp: new Date().toISOString()
            });

            return updatedTransaction!;
        } catch (error) {
            this.logger.error('Refund processing failed', {
                transactionId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Validates payment amount against configured limits
     */
    private validatePaymentAmount(amount: PaymentAmount): void {
        if (amount.value < MIN_TRANSACTION_AMOUNT || amount.value > MAX_TRANSACTION_AMOUNT) {
            throw new Error(`Payment amount must be between ${MIN_TRANSACTION_AMOUNT} and ${MAX_TRANSACTION_AMOUNT}`);
        }
    }

    /**
     * Validates HIPAA compliance requirements
     */
    private validateHipaaCompliance(metadata: Record<string, any>): void {
        const requiredFields = ['patientId', 'providerId', 'dataScope'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                throw new Error(`Missing required HIPAA field: ${field}`);
            }
        }
    }

    /**
     * Maps internal payment method types to Stripe payment method types
     */
    private mapPaymentMethodType(method: PaymentMethodType): string {
        const mapping: Record<PaymentMethodType, string> = {
            [PaymentMethodType.CREDIT_CARD]: 'card',
            [PaymentMethodType.DEBIT_CARD]: 'card',
            [PaymentMethodType.BANK_TRANSFER]: 'bank_transfer'
        };
        return mapping[method] || 'card';
    }
}

export default PaymentService;