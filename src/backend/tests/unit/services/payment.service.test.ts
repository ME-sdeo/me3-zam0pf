import { PaymentService } from '../../../src/services/payment.service';
import { TransactionModel } from '../../../src/models/transaction.model';
import { FabricService } from '../../../src/blockchain/services/fabric.service';
import { Stripe } from 'stripe'; // ^8.222.0
import { Logger } from 'winston'; // ^3.8.2
import { PaymentMethodType, PaymentCurrency, ComplianceRules, BlockchainConfig } from '../../../src/interfaces/payment.interface';
import { TransactionStatus } from '../../../src/types/marketplace.types';
import { TransactionType } from '../../../src/types/blockchain.types';

// Mock dependencies
jest.mock('stripe');
jest.mock('../../../src/models/transaction.model');
jest.mock('../../../src/blockchain/services/fabric.service');
jest.mock('winston');

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: jest.Mocked<Stripe>;
  let mockTransactionModel: jest.Mocked<typeof TransactionModel>;
  let mockFabricService: jest.Mocked<FabricService>;
  let mockLogger: jest.Mocked<Logger>;

  const testComplianceRules: ComplianceRules = {
    hipaaRequired: true,
    gdprRequired: true,
    hitechRequired: true,
    auditTrailRequired: true,
    retentionPeriodDays: 2555 // 7 years
  };

  const testBlockchainConfig: BlockchainConfig = {
    networkId: 'test-network',
    channelName: 'consentchannel',
    chaincodeName: 'consentcontract',
    transactionType: 'PAYMENT'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockStripe = new Stripe('test_key') as jest.Mocked<Stripe>;
    mockTransactionModel = TransactionModel as jest.Mocked<typeof TransactionModel>;
    mockFabricService = new FabricService() as jest.Mocked<FabricService>;
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    // Initialize PaymentService with mocks
    paymentService = new PaymentService(
      'test_stripe_key',
      mockFabricService,
      mockLogger,
      mockTransactionModel
    );
  });

  describe('createPaymentIntent', () => {
    it('should create a HIPAA-compliant payment intent', async () => {
      // Arrange
      const amount = { value: 100, currency: PaymentCurrency.USD };
      const paymentMethod = PaymentMethodType.CREDIT_CARD;
      const metadata = {
        patientId: 'test-patient',
        providerId: 'test-provider',
        dataScope: ['EHR', 'Labs']
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'requires_payment_method',
        client_secret: 'test_secret',
        amount: 10000,
        currency: 'usd'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent as any);

      // Act
      const result = await paymentService.createPaymentIntent(
        amount,
        paymentMethod,
        metadata,
        testComplianceRules
      );

      // Assert
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000, // 100 USD in cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          ...metadata,
          hipaaCompliant: true,
          gdprCompliant: true,
          retentionPeriod: 2555
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Payment intent created',
        expect.objectContaining({
          intentId: 'pi_test123',
          amount: 100,
          currency: 'USD'
        })
      );

      expect(result).toEqual(mockPaymentIntent);
    });

    it('should throw error for non-compliant metadata', async () => {
      // Arrange
      const amount = { value: 100, currency: PaymentCurrency.USD };
      const paymentMethod = PaymentMethodType.CREDIT_CARD;
      const invalidMetadata = { invalidField: 'test' };

      // Act & Assert
      await expect(
        paymentService.createPaymentIntent(
          amount,
          paymentMethod,
          invalidMetadata,
          testComplianceRules
        )
      ).rejects.toThrow('Missing required HIPAA field');
    });
  });

  describe('processPayment', () => {
    it('should process payment with blockchain integration', async () => {
      // Arrange
      const paymentIntentId = 'pi_test123';
      const requestId = 'req_test123';
      
      const mockPaymentIntent = {
        id: paymentIntentId,
        status: 'succeeded',
        amount: 10000,
        currency: 'usd',
        metadata: {
          hipaaCompliant: true
        }
      };

      const mockTransaction = {
        id: 'tx_test123',
        status: TransactionStatus.COMPLETED,
        blockchainRef: 'block_test123'
      };

      const mockBlockchainTx = {
        transactionId: 'block_test123',
        type: TransactionType.PAYMENT_PROCESSED
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any);
      mockTransactionModel.create.mockResolvedValue(mockTransaction as any);
      mockFabricService.recordTransaction.mockResolvedValue(mockBlockchainTx as any);
      mockTransactionModel.updateStatus.mockResolvedValue(mockTransaction as any);

      // Act
      const result = await paymentService.processPayment(
        paymentIntentId,
        requestId,
        testBlockchainConfig
      );

      // Assert
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId);
      expect(mockTransactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          paymentIntentId,
          amount: 100,
          status: TransactionStatus.PROCESSING
        })
      );
      expect(mockFabricService.recordTransaction).toHaveBeenCalled();
      expect(mockTransactionModel.updateStatus).toHaveBeenCalledWith(
        'tx_test123',
        TransactionStatus.COMPLETED,
        'block_test123'
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should handle failed payment intent', async () => {
      // Arrange
      const paymentIntentId = 'pi_test123';
      const requestId = 'req_test123';
      
      const mockPaymentIntent = {
        id: paymentIntentId,
        status: 'requires_payment_method',
        amount: 10000
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any);

      // Act & Assert
      await expect(
        paymentService.processPayment(paymentIntentId, requestId, testBlockchainConfig)
      ).rejects.toThrow('Invalid payment intent status');
    });
  });

  describe('refundPayment', () => {
    it('should process refund with blockchain recording', async () => {
      // Arrange
      const transactionId = 'tx_test123';
      const reason = 'requested_by_customer';
      const refundAmount = { value: 100, currency: PaymentCurrency.USD };

      const mockTransaction = {
        id: transactionId,
        paymentIntentId: 'pi_test123',
        status: TransactionStatus.COMPLETED
      };

      const mockRefund = {
        id: 'ref_test123',
        status: 'succeeded'
      };

      const mockBlockchainTx = {
        transactionId: 'block_test123',
        type: TransactionType.PAYMENT_PROCESSED
      };

      mockTransactionModel.findOne.mockResolvedValue(mockTransaction as any);
      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);
      mockFabricService.recordTransaction.mockResolvedValue(mockBlockchainTx as any);
      mockTransactionModel.updateStatus.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.REFUNDED
      } as any);

      // Act
      const result = await paymentService.refundPayment(
        transactionId,
        reason,
        refundAmount,
        testComplianceRules
      );

      // Assert
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        amount: 10000,
        reason: reason
      });
      expect(mockFabricService.recordTransaction).toHaveBeenCalled();
      expect(mockTransactionModel.updateStatus).toHaveBeenCalledWith(
        transactionId,
        TransactionStatus.REFUNDED,
        'block_test123'
      );
      expect(result.status).toBe(TransactionStatus.REFUNDED);
    });

    it('should handle non-existent transaction', async () => {
      // Arrange
      const transactionId = 'tx_test123';
      const reason = 'requested_by_customer';
      const refundAmount = { value: 100, currency: PaymentCurrency.USD };

      mockTransactionModel.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentService.refundPayment(
          transactionId,
          reason,
          refundAmount,
          testComplianceRules
        )
      ).rejects.toThrow('Transaction tx_test123 not found');
    });
  });
});