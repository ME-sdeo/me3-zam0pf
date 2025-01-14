import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { PaymentService } from '../../services/payment.service';
import { BlockchainService } from '@myelixir/blockchain'; // ^1.0.0
import { AuditService } from '@myelixir/audit'; // ^1.0.0
import { PaymentAmount, PaymentMethodType, ComplianceRules } from '../../interfaces/payment.interface';
import { TransactionStatus } from '../../types/marketplace.types';
import { validate } from 'class-validator'; // ^0.14.0
import { RateLimit } from 'express-rate-limit'; // ^6.7.0
import { Logger } from 'winston'; // ^3.8.2

/**
 * HIPAA-compliant payment controller with blockchain verification
 * Handles payment operations for the MyElixir healthcare data marketplace
 */
export class PaymentController {
    private readonly logger: Logger;

    constructor(
        private readonly paymentService: PaymentService,
        private readonly blockchainService: BlockchainService,
        private readonly auditService: AuditService
    ) {
        this.logger = new Logger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: { service: 'payment-controller' }
        });
    }

    /**
     * Creates a new HIPAA-compliant payment intent
     * @route POST /api/v1/payment/intent
     */
    @RateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
    public async createPaymentIntent(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { amount, paymentMethod, metadata } = req.body;

            // Validate request data
            await this.validatePaymentRequest(amount, paymentMethod, metadata);

            // Configure compliance rules
            const complianceConfig: ComplianceRules = {
                hipaaRequired: true,
                gdprRequired: true,
                hitechRequired: true,
                auditTrailRequired: true,
                retentionPeriodDays: 2555 // 7 years
            };

            // Create payment intent
            const paymentIntent = await this.paymentService.createPaymentIntent(
                amount,
                paymentMethod,
                metadata,
                complianceConfig
            );

            // Record audit trail
            await this.auditService.logEvent({
                action: 'PAYMENT_INTENT_CREATED',
                resourceId: paymentIntent.id,
                userId: req.user.id,
                metadata: {
                    amount,
                    paymentMethod,
                    complianceStatus: 'COMPLIANT'
                }
            });

            res.status(201).json({
                success: true,
                data: paymentIntent
            });
        } catch (error) {
            this.logger.error('Payment intent creation failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            next(error);
        }
    }

    /**
     * Processes a payment with blockchain verification
     * @route POST /api/v1/payment/process
     */
    @RateLimit({ windowMs: 15 * 60 * 1000, max: 50 })
    public async processPayment(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { paymentIntentId, requestId } = req.body;

            // Verify blockchain configuration
            const blockchainConfig = {
                networkId: process.env.BLOCKCHAIN_NETWORK_ID,
                channelName: 'consentchannel',
                chaincodeName: 'consentcontract',
                transactionType: 'PAYMENT_PROCESSED'
            };

            // Process payment
            const transaction = await this.paymentService.processPayment(
                paymentIntentId,
                requestId,
                blockchainConfig
            );

            // Record blockchain transaction
            await this.blockchainService.recordTransaction({
                transactionId: transaction.id,
                type: 'PAYMENT_PROCESSED',
                metadata: {
                    paymentIntentId,
                    requestId,
                    amount: transaction.amount,
                    status: TransactionStatus.COMPLETED
                }
            });

            // Record audit trail
            await this.auditService.logEvent({
                action: 'PAYMENT_PROCESSED',
                resourceId: transaction.id,
                userId: req.user.id,
                metadata: {
                    paymentIntentId,
                    requestId,
                    blockchainRef: transaction.blockchainRecord.transactionId
                }
            });

            res.status(200).json({
                success: true,
                data: transaction
            });
        } catch (error) {
            this.logger.error('Payment processing failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            next(error);
        }
    }

    /**
     * Processes a refund with compliance tracking
     * @route POST /api/v1/payment/refund
     */
    @RateLimit({ windowMs: 15 * 60 * 1000, max: 25 })
    public async refundPayment(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { transactionId, reason, refundAmount } = req.body;

            // Configure compliance for refund
            const complianceConfig: ComplianceRules = {
                hipaaRequired: true,
                gdprRequired: true,
                hitechRequired: true,
                auditTrailRequired: true,
                retentionPeriodDays: 2555 // 7 years
            };

            // Process refund
            const refundTransaction = await this.paymentService.refundPayment(
                transactionId,
                reason,
                refundAmount,
                complianceConfig
            );

            // Record audit trail
            await this.auditService.logEvent({
                action: 'PAYMENT_REFUNDED',
                resourceId: refundTransaction.id,
                userId: req.user.id,
                metadata: {
                    originalTransactionId: transactionId,
                    reason,
                    refundAmount,
                    blockchainRef: refundTransaction.blockchainRecord.transactionId
                }
            });

            res.status(200).json({
                success: true,
                data: refundTransaction
            });
        } catch (error) {
            this.logger.error('Payment refund failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            next(error);
        }
    }

    /**
     * Validates payment request data
     */
    private async validatePaymentRequest(
        amount: PaymentAmount,
        paymentMethod: PaymentMethodType,
        metadata: Record<string, any>
    ): Promise<void> {
        // Validate amount
        if (!amount || amount.value <= 0) {
            throw new Error('Invalid payment amount');
        }

        // Validate payment method
        if (!Object.values(PaymentMethodType).includes(paymentMethod)) {
            throw new Error('Invalid payment method');
        }

        // Validate required HIPAA metadata
        const requiredFields = ['patientId', 'providerId', 'dataScope'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                throw new Error(`Missing required HIPAA field: ${field}`);
            }
        }
    }
}

export default PaymentController;