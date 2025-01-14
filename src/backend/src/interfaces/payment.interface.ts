import { TransactionStatus } from '../types/marketplace.types';
import { BlockchainTransaction } from '../types/blockchain.types';
import { PaymentIntent } from '@types/stripe'; // ^8.0.417

/**
 * Enum defining supported payment method types
 */
export enum PaymentMethodType {
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER'
}

/**
 * Enum defining supported payment currencies
 */
export enum PaymentCurrency {
    USD = 'USD',
    EUR = 'EUR',
    GBP = 'GBP'
}

/**
 * Interface defining payment amount structure with currency
 */
export interface PaymentAmount {
    value: number;
    currency: PaymentCurrency;
}

/**
 * Interface defining compliance verification requirements
 */
export interface ComplianceRules {
    hipaaRequired: boolean;
    gdprRequired: boolean;
    hitechRequired: boolean;
    auditTrailRequired: boolean;
    retentionPeriodDays: number;
}

/**
 * Interface defining blockchain configuration for payment recording
 */
export interface BlockchainConfig {
    networkId: string;
    channelName: string;
    chaincodeName: string;
    transactionType: string;
}

/**
 * Interface defining compliance verification result
 */
export interface ComplianceVerification {
    verified: boolean;
    timestamp: Date;
    verificationId: string;
    rules: ComplianceRules;
    verifierDetails: {
        name: string;
        id: string;
        signature: string;
    };
}

/**
 * Interface defining payment transaction structure
 */
export interface IPaymentTransaction {
    transactionId: string;
    paymentIntentId: string;
    requestId: string;
    amount: PaymentAmount;
    paymentMethod: PaymentMethodType;
    status: TransactionStatus;
    blockchainRecord: BlockchainTransaction;
    complianceCheck: ComplianceVerification;
    createdAt: Date;
    updatedAt: Date;
    metadata: {
        userId: string;
        companyId: string;
        dataRequestId: string;
        resourceIds: string[];
        [key: string]: any;
    };
}

/**
 * Interface defining core payment service functionality
 */
export interface IPaymentService {
    /**
     * Creates a new payment intent with compliance verification
     * @param amount - Payment amount with currency
     * @param paymentMethod - Payment method type
     * @param metadata - Additional payment metadata
     * @param complianceConfig - Compliance verification rules
     * @returns Promise resolving to created payment intent
     */
    createPaymentIntent(
        amount: PaymentAmount,
        paymentMethod: PaymentMethodType,
        metadata: Record<string, any>,
        complianceConfig: ComplianceRules
    ): Promise<PaymentIntent>;

    /**
     * Processes a payment with blockchain recording
     * @param paymentIntentId - Stripe payment intent ID
     * @param requestId - Data request ID
     * @param blockchainConfig - Blockchain recording configuration
     * @returns Promise resolving to processed payment transaction
     */
    processPayment(
        paymentIntentId: string,
        requestId: string,
        blockchainConfig: BlockchainConfig
    ): Promise<IPaymentTransaction>;

    /**
     * Processes a refund with compliance tracking
     * @param transactionId - Original transaction ID
     * @param reason - Refund reason
     * @param refundAmount - Amount to refund
     * @param complianceConfig - Compliance verification rules
     * @returns Promise resolving to refund transaction
     */
    refundPayment(
        transactionId: string,
        reason: string,
        refundAmount: PaymentAmount,
        complianceConfig: ComplianceRules
    ): Promise<IPaymentTransaction>;

    /**
     * Verifies payment compliance with healthcare regulations
     * @param transactionId - Transaction ID to verify
     * @param rules - Compliance rules to verify against
     * @returns Promise resolving to compliance verification result
     */
    verifyCompliance(
        transactionId: string,
        rules: ComplianceRules
    ): Promise<ComplianceVerification>;

    /**
     * Records payment transaction on blockchain
     * @param transaction - Payment transaction to record
     * @param config - Blockchain configuration
     * @returns Promise resolving to blockchain transaction record
     */
    recordBlockchainTransaction(
        transaction: IPaymentTransaction,
        config: BlockchainConfig
    ): Promise<BlockchainTransaction>;
}

// Global constants for payment processing
export const DEFAULT_CURRENCY = PaymentCurrency.USD;
export const MIN_TRANSACTION_AMOUNT = 0.50;
export const MAX_TRANSACTION_AMOUNT = 50000.00;
export const COMPLIANCE_CHECK_TIMEOUT = 30000;
export const BLOCKCHAIN_RECORD_TIMEOUT = 60000;