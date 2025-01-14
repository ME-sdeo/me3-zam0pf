import api from '../utils/api.util';
import { PaymentIntent } from '@stripe/stripe-js'; // ^1.54.0
import { BlockchainVerification } from '@hyperledger/fabric-gateway'; // ^1.1.0
import { 
  IPaymentMethod, 
  IPaymentTransaction,
  PaymentMethodType,
  PaymentCurrency,
  DEFAULT_CURRENCY,
  MIN_PAYMENT_AMOUNT,
  MAX_PAYMENT_AMOUNT,
  PAYMENT_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS
} from '../interfaces/payment.interface';
import { TransactionStatus } from '../types/marketplace.types';
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Interface for payment intent creation request
 */
interface ICreatePaymentIntentRequest {
  amount: number;
  currency: PaymentCurrency;
  paymentMethodId: string;
  requestId: string;
  metadata: {
    dataProvider: string;
    dataConsumer: string;
    recordCount: number;
    consentId: string;
  };
}

/**
 * Interface for blockchain verification request
 */
interface IBlockchainVerificationRequest {
  transactionId: string;
  paymentIntentId: string;
  amount: number;
  currency: PaymentCurrency;
  timestamp: number;
  metadata: Record<string, any>;
}

/**
 * Enhanced payment API service with HIPAA compliance and blockchain verification
 */
class PaymentAPI {
  private static readonly ENDPOINTS = API_ENDPOINTS.PAYMENT;
  private static readonly BLOCKCHAIN_ENDPOINTS = API_ENDPOINTS.BLOCKCHAIN;

  /**
   * Creates a new payment intent with blockchain verification
   * @param paymentDetails Payment intent creation details
   * @returns Created payment intent with blockchain reference
   */
  public static async createPaymentIntent(
    paymentDetails: ICreatePaymentIntentRequest
  ): Promise<IPaymentTransaction> {
    // Validate payment amount
    if (
      paymentDetails.amount < MIN_PAYMENT_AMOUNT || 
      paymentDetails.amount > MAX_PAYMENT_AMOUNT
    ) {
      throw new Error('Invalid payment amount');
    }

    try {
      // Create payment intent
      const response = await api.post<IPaymentTransaction>(
        this.ENDPOINTS.PROCESS,
        paymentDetails,
        {
          timeout: PAYMENT_TIMEOUT_MS,
          headers: {
            'X-HIPAA-Compliance': 'true',
            'X-Payment-Version': '2023-05'
          }
        }
      );

      // Create blockchain verification record
      const blockchainVerification = await this.createBlockchainVerification({
        transactionId: response.data.transactionId,
        paymentIntentId: response.data.paymentGatewayResponse.paymentIntent?.id || '',
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        timestamp: Date.now(),
        metadata: paymentDetails.metadata
      });

      // Update transaction with blockchain reference
      return {
        ...response.data,
        blockchainRef: blockchainVerification.transactionHash
      };
    } catch (error) {
      console.error('Payment intent creation failed:', error);
      throw error;
    }
  }

  /**
   * Confirms a payment with blockchain verification
   * @param paymentIntentId Payment intent ID to confirm
   * @param blockchainRef Blockchain reference for verification
   * @returns Confirmed payment transaction
   */
  public static async confirmPayment(
    paymentIntentId: string,
    blockchainRef: string
  ): Promise<IPaymentTransaction> {
    try {
      // Verify blockchain transaction
      const blockchainVerification = await this.verifyBlockchainTransaction(blockchainRef);
      
      if (!blockchainVerification.isValid) {
        throw new Error('Blockchain verification failed');
      }

      // Confirm payment
      const response = await api.post<IPaymentTransaction>(
        this.ENDPOINTS.VERIFY,
        {
          paymentIntentId,
          blockchainRef,
          verificationResult: blockchainVerification
        }
      );

      return response.data;
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves payment transaction history
   * @param filters Optional filters for transaction history
   * @returns Array of payment transactions
   */
  public static async getPaymentHistory(
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: TransactionStatus;
      paymentMethod?: PaymentMethodType;
    }
  ): Promise<IPaymentTransaction[]> {
    try {
      const response = await api.get<IPaymentTransaction[]>(
        this.ENDPOINTS.HISTORY,
        { params: filters }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to retrieve payment history:', error);
      throw error;
    }
  }

  /**
   * Creates blockchain verification record
   * @param verificationData Blockchain verification data
   * @returns Blockchain verification result
   */
  private static async createBlockchainVerification(
    verificationData: IBlockchainVerificationRequest
  ): Promise<BlockchainVerification> {
    try {
      const response = await api.post<BlockchainVerification>(
        this.BLOCKCHAIN_ENDPOINTS.TRANSACTION,
        verificationData
      );
      return response.data;
    } catch (error) {
      console.error('Blockchain verification creation failed:', error);
      throw error;
    }
  }

  /**
   * Verifies blockchain transaction
   * @param blockchainRef Blockchain reference to verify
   * @returns Verification result
   */
  private static async verifyBlockchainTransaction(
    blockchainRef: string
  ): Promise<BlockchainVerification> {
    try {
      const response = await api.get<BlockchainVerification>(
        `${this.BLOCKCHAIN_ENDPOINTS.VERIFY}/${blockchainRef}`
      );
      return response.data;
    } catch (error) {
      console.error('Blockchain verification failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves saved payment methods
   * @returns Array of saved payment methods
   */
  public static async getSavedPaymentMethods(): Promise<IPaymentMethod[]> {
    try {
      const response = await api.get<IPaymentMethod[]>(
        this.ENDPOINTS.METHODS
      );
      return response.data;
    } catch (error) {
      console.error('Failed to retrieve payment methods:', error);
      throw error;
    }
  }
}

export default PaymentAPI;