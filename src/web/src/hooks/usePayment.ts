import { useDispatch, useSelector } from 'react-redux'; // react-redux ^8.1.0
import { useState, useCallback } from 'react'; // react ^18.0.0
import { 
  initializePayment,
  processPayment,
  fetchPaymentHistory,
  verifyBlockchainTransaction
} from '../store/actions/payment.actions';
import { 
  IPaymentTransaction,
  IPaymentMethod,
  IPaymentAmount
} from '../interfaces/payment.interface';

// Error messages for payment operations
const PAYMENT_ERROR_MESSAGES = {
  CREATE_INTENT_FAILED: 'Failed to create payment intent: {error}',
  CONFIRM_PAYMENT_FAILED: 'Failed to confirm payment: {error}',
  GET_HISTORY_FAILED: 'Failed to retrieve payment history: {error}',
  BLOCKCHAIN_VERIFICATION_FAILED: 'Failed to verify blockchain transaction: {error}',
  COMPLIANCE_LOG_FAILED: 'Failed to create compliance log: {error}'
} as const;

// Configuration for payment retry mechanism
const PAYMENT_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BACKOFF_FACTOR: 1.5,
  INITIAL_DELAY: 1000
} as const;

/**
 * Custom hook for managing secure, HIPAA-compliant payment processing
 * with blockchain verification and transaction management
 */
export const usePayment = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainVerified, setBlockchainVerified] = useState(false);

  // Selector for payment history from Redux store
  const paymentHistory = useSelector((state: any) => state.payment.history);

  /**
   * Creates a new payment intent with blockchain verification
   */
  const createPaymentIntent = useCallback(async (
    paymentDetails: {
      amount: IPaymentAmount;
      paymentMethod: IPaymentMethod;
      metadata: {
        requestId: string;
        dataProvider: string;
        dataConsumer: string;
        recordCount: number;
        consentId: string;
      };
    }
  ): Promise<IPaymentTransaction> => {
    setLoading(true);
    setError(null);
    
    try {
      // Create payment intent with compliance metadata
      const paymentIntent = await dispatch(initializePayment(
        paymentDetails.amount,
        paymentDetails.paymentMethod,
        {
          hipaaCompliant: true,
          ...paymentDetails.metadata
        }
      ));

      // Verify blockchain transaction
      const blockchainVerification = await dispatch(verifyBlockchainTransaction(
        paymentIntent.metadata.blockchainRef
      ));

      if (!blockchainVerification) {
        throw new Error(PAYMENT_ERROR_MESSAGES.BLOCKCHAIN_VERIFICATION_FAILED);
      }

      setBlockchainVerified(true);
      return paymentIntent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(PAYMENT_ERROR_MESSAGES.CREATE_INTENT_FAILED.replace('{error}', errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Confirms a payment with blockchain verification
   */
  const confirmPayment = useCallback(async (
    paymentIntentId: string,
    blockchainData: Record<string, unknown>
  ): Promise<IPaymentTransaction> => {
    setLoading(true);
    setError(null);

    try {
      const confirmedPayment = await dispatch(processPayment(
        paymentIntentId,
        blockchainData
      ));

      // Verify final blockchain status
      const verificationResult = await dispatch(verifyBlockchainTransaction(
        confirmedPayment.blockchainRef
      ));

      if (!verificationResult) {
        throw new Error(PAYMENT_ERROR_MESSAGES.BLOCKCHAIN_VERIFICATION_FAILED);
      }

      return confirmedPayment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(PAYMENT_ERROR_MESSAGES.CONFIRM_PAYMENT_FAILED.replace('{error}', errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Retrieves payment history with pagination
   */
  const getPaymentHistory = useCallback(async (
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<IPaymentTransaction[]> => {
    setLoading(true);
    setError(null);

    try {
      const history = await dispatch(fetchPaymentHistory(userId, page, limit));
      return history;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(PAYMENT_ERROR_MESSAGES.GET_HISTORY_FAILED.replace('{error}', errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Verifies a blockchain transaction
   */
  const verifyBlockchainTransaction = useCallback(async (
    blockchainRef: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const isValid = await dispatch(verifyBlockchainTransaction(blockchainRef));
      setBlockchainVerified(isValid);
      return isValid;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(PAYMENT_ERROR_MESSAGES.BLOCKCHAIN_VERIFICATION_FAILED.replace('{error}', errorMessage));
      return false;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  return {
    createPaymentIntent,
    confirmPayment,
    getPaymentHistory,
    verifyBlockchainTransaction,
    loading,
    error,
    blockchainVerified,
    paymentHistory
  };
};