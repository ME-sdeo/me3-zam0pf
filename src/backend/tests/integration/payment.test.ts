import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import { Stripe } from 'stripe'; // ^8.222.0
import { GenericContainer, StartedTestContainer } from 'testcontainers'; // ^9.0.0
import Web3 from 'web3'; // ^1.9.0

import { PaymentService } from '../../src/services/payment.service';
import { PaymentMethodType } from '../../src/interfaces/payment.interface';
import { TransactionModel } from '../../src/models/transaction.model';
import { TransactionStatus } from '../../src/types/marketplace.types';
import { TransactionType } from '../../src/types/blockchain.types';
import { FabricService } from '../../src/blockchain/services/fabric.service';

// Test constants
const TEST_STRIPE_KEY = process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_mock';
const TEST_BLOCKCHAIN_ENDPOINT = process.env.TEST_BLOCKCHAIN_ENDPOINT || 'http://localhost:8545';
const TEST_PAYMENT_AMOUNT = 100.00;
const TEST_REQUEST_ID = 'test-request-123';
const COMPLIANCE_LEVEL = 'HIPAA_FULL';

describe('Payment Integration Tests', () => {
    let paymentService: PaymentService;
    let fabricService: FabricService;
    let mongoContainer: StartedTestContainer;
    let stripe: Stripe;
    let web3: Web3;

    beforeAll(async () => {
        // Start MongoDB test container
        mongoContainer = await new GenericContainer('mongo:5.0')
            .withExposedPorts(27017)
            .withEnvironment({
                MONGO_INITDB_DATABASE: 'test_db',
                MONGO_INITDB_ROOT_USERNAME: 'test_user',
                MONGO_INITDB_ROOT_PASSWORD: 'test_password'
            })
            .start();

        // Initialize Stripe test client
        stripe = new Stripe(TEST_STRIPE_KEY, {
            apiVersion: '2022-11-15',
            typescript: true
        });

        // Initialize Web3 for blockchain testing
        web3 = new Web3(TEST_BLOCKCHAIN_ENDPOINT);

        // Initialize FabricService with test configuration
        fabricService = new FabricService();
        await fabricService.connect();

        // Initialize PaymentService with test dependencies
        paymentService = new PaymentService(
            TEST_STRIPE_KEY,
            fabricService,
            jest.fn() as any, // Mock logger
            TransactionModel
        );

        // Clear test data
        await TransactionModel.deleteMany({});
    });

    afterAll(async () => {
        // Stop test containers and cleanup
        await mongoContainer.stop();
        await fabricService.disconnect();
    });

    describe('Payment Processing Workflow', () => {
        it('should process a complete payment workflow with HIPAA compliance', async () => {
            // Create payment intent
            const paymentIntent = await paymentService.createPaymentIntent(
                { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                PaymentMethodType.CREDIT_CARD,
                {
                    requestId: TEST_REQUEST_ID,
                    patientId: 'test-patient-123',
                    providerId: 'test-provider-123',
                    dataScope: ['EHR', 'Labs']
                },
                {
                    hipaaRequired: true,
                    gdprRequired: false,
                    hitechRequired: true,
                    auditTrailRequired: true,
                    retentionPeriodDays: 2555 // 7 years
                }
            );

            expect(paymentIntent).toBeDefined();
            expect(paymentIntent.status).toBe('requires_payment_method');
            expect(paymentIntent.amount).toBe(TEST_PAYMENT_AMOUNT * 100);

            // Process payment
            const transaction = await paymentService.processPayment(
                paymentIntent.id,
                TEST_REQUEST_ID,
                {
                    networkId: 'test-network',
                    channelName: 'test-channel',
                    chaincodeName: 'test-chaincode',
                    transactionType: TransactionType.PAYMENT_PROCESSED
                }
            );

            expect(transaction).toBeDefined();
            expect(transaction.status).toBe(TransactionStatus.COMPLETED);
            expect(transaction.blockchainRef).toBeDefined();

            // Verify blockchain record
            const blockchainTx = await fabricService.submitConsent({
                id: transaction.id,
                patientId: 'test-patient-123',
                providerId: 'test-provider-123',
                dataScope: ['EHR', 'Labs'],
                validFrom: new Date(),
                validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: 'ACTIVE',
                metadata: {
                    hipaaCompliant: true,
                    gdprCompliant: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });

            expect(blockchainTx).toBeDefined();
        });

        it('should handle concurrent payment processing', async () => {
            const paymentRequests = await Promise.all([
                paymentService.createPaymentIntent(
                    { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                    PaymentMethodType.CREDIT_CARD,
                    { requestId: `${TEST_REQUEST_ID}-1` },
                    {
                        hipaaRequired: true,
                        gdprRequired: false,
                        hitechRequired: true,
                        auditTrailRequired: true,
                        retentionPeriodDays: 2555
                    }
                ),
                paymentService.createPaymentIntent(
                    { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                    PaymentMethodType.CREDIT_CARD,
                    { requestId: `${TEST_REQUEST_ID}-2` },
                    {
                        hipaaRequired: true,
                        gdprRequired: false,
                        hitechRequired: true,
                        auditTrailRequired: true,
                        retentionPeriodDays: 2555
                    }
                )
            ]);

            const transactions = await Promise.all(
                paymentRequests.map(intent =>
                    paymentService.processPayment(
                        intent.id,
                        intent.metadata.requestId,
                        {
                            networkId: 'test-network',
                            channelName: 'test-channel',
                            chaincodeName: 'test-chaincode',
                            transactionType: TransactionType.PAYMENT_PROCESSED
                        }
                    )
                )
            );

            expect(transactions).toHaveLength(2);
            transactions.forEach(tx => {
                expect(tx.status).toBe(TransactionStatus.COMPLETED);
                expect(tx.blockchainRef).toBeDefined();
            });
        });

        it('should handle payment refunds with compliance tracking', async () => {
            // Create and process initial payment
            const paymentIntent = await paymentService.createPaymentIntent(
                { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                PaymentMethodType.CREDIT_CARD,
                { requestId: TEST_REQUEST_ID },
                {
                    hipaaRequired: true,
                    gdprRequired: false,
                    hitechRequired: true,
                    auditTrailRequired: true,
                    retentionPeriodDays: 2555
                }
            );

            const transaction = await paymentService.processPayment(
                paymentIntent.id,
                TEST_REQUEST_ID,
                {
                    networkId: 'test-network',
                    channelName: 'test-channel',
                    chaincodeName: 'test-chaincode',
                    transactionType: TransactionType.PAYMENT_PROCESSED
                }
            );

            // Process refund
            const refundTransaction = await paymentService.refundPayment(
                transaction.id,
                'requested_by_customer',
                { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                {
                    hipaaRequired: true,
                    gdprRequired: false,
                    hitechRequired: true,
                    auditTrailRequired: true,
                    retentionPeriodDays: 2555
                }
            );

            expect(refundTransaction.status).toBe(TransactionStatus.REFUNDED);
            expect(refundTransaction.blockchainRef).toBeDefined();
        });

        it('should validate HIPAA compliance requirements', async () => {
            await expect(
                paymentService.createPaymentIntent(
                    { value: TEST_PAYMENT_AMOUNT, currency: 'USD' },
                    PaymentMethodType.CREDIT_CARD,
                    { requestId: TEST_REQUEST_ID }, // Missing required HIPAA fields
                    {
                        hipaaRequired: true,
                        gdprRequired: false,
                        hitechRequired: true,
                        auditTrailRequired: true,
                        retentionPeriodDays: 2555
                    }
                )
            ).rejects.toThrow('Missing required HIPAA field');
        });
    });
});