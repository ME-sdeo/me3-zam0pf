import { PaymentIntent } from '@stripe/stripe-js'; // @stripe/stripe-js ^1.54.0
import { ThunkAction } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^1.9.5
import { PaymentService } from '../../services/payment.service';
import { 
  IPaymentMethod, 
  IPaymentAmount, 
  IPaymentTransaction,
  MAX_RETRY_ATTEMPTS 
} from '../../interfaces/payment.interface';

// Action type constants with comprehensive coverage of payment operations
export const PAYMENT_ACTION_TYPES = {
  INITIALIZE_PAYMENT_START: 'payment/initializePaymentStart',
  INITIALIZE_PAYMENT_SUCCESS: 'payment/initializePaymentSuccess',
  INITIALIZE_PAYMENT_FAILURE: 'payment/initializePaymentFailure',
  
  PROCESS_PAYMENT_START: 'payment/processPaymentStart',
  PROCESS_PAYMENT_SUCCESS: 'payment/processPaymentSuccess',
  PROCESS_PAYMENT_FAILURE: 'payment/processPaymentFailure',
  
  FETCH_HISTORY_START: 'payment/fetchHistoryStart',
  FETCH_HISTORY_SUCCESS: 'payment/fetchHistorySuccess',
  FETCH_HISTORY_FAILURE: 'payment/fetchHistoryFailure',
  
  VERIFY_BLOCKCHAIN_START: 'payment/verifyBlockchainStart',
  VERIFY_BLOCKCHAIN_SUCCESS: 'payment/verifyBlockchainSuccess',
  VERIFY_BLOCKCHAIN_FAILURE: 'payment/verifyBlockchainFailure'
} as const;

// Action interfaces for type safety
interface PaymentAction {
  type: string;
  payload?: any;
  error?: Error;
}

// Initialize payment action creator with HIPAA compliance and blockchain verification
export const initializePayment = (
  amount: IPaymentAmount,
  paymentMethod: IPaymentMethod,
  complianceMetadata: Record<string, unknown>
): ThunkAction<Promise<PaymentIntent>, any, unknown, PaymentAction> => {
  return async (dispatch) => {
    const paymentService = new PaymentService();
    
    try {
      dispatch({ type: PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_START });
      
      const paymentIntent = await withRetry(() => 
        paymentService.initializePayment(
          amount,
          paymentMethod,
          complianceMetadata
        )
      );
      
      dispatch({
        type: PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_SUCCESS,
        payload: paymentIntent
      });
      
      return paymentIntent;
    } catch (error) {
      dispatch({
        type: PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_FAILURE,
        error: error instanceof Error ? error : new Error('Payment initialization failed')
      });
      throw error;
    }
  };
};

// Process payment action creator with blockchain verification
export const processPayment = (
  paymentIntentId: string,
  blockchainData: Record<string, unknown>
): ThunkAction<Promise<IPaymentTransaction>, any, unknown, PaymentAction> => {
  return async (dispatch) => {
    const paymentService = new PaymentService();
    
    try {
      dispatch({ type: PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_START });
      
      const transaction = await withRetry(() =>
        paymentService.processPayment(
          paymentIntentId,
          blockchainData
        )
      );
      
      dispatch({
        type: PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_SUCCESS,
        payload: transaction
      });
      
      return transaction;
    } catch (error) {
      dispatch({
        type: PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_FAILURE,
        error: error instanceof Error ? error : new Error('Payment processing failed')
      });
      throw error;
    }
  };
};

// Fetch payment history action creator with pagination support
export const fetchPaymentHistory = (
  userId: string,
  page: number = 1,
  limit: number = 10
): ThunkAction<Promise<IPaymentTransaction[]>, any, unknown, PaymentAction> => {
  return async (dispatch) => {
    const paymentService = new PaymentService();
    
    try {
      dispatch({ type: PAYMENT_ACTION_TYPES.FETCH_HISTORY_START });
      
      const history = await withRetry(() =>
        paymentService.fetchPaymentHistory(userId, page, limit)
      );
      
      dispatch({
        type: PAYMENT_ACTION_TYPES.FETCH_HISTORY_SUCCESS,
        payload: history
      });
      
      return history;
    } catch (error) {
      dispatch({
        type: PAYMENT_ACTION_TYPES.FETCH_HISTORY_FAILURE,
        error: error instanceof Error ? error : new Error('Failed to fetch payment history')
      });
      throw error;
    }
  };
};

// Verify blockchain transaction action creator
export const verifyBlockchainTransaction = (
  blockchainRef: string
): ThunkAction<Promise<boolean>, any, unknown, PaymentAction> => {
  return async (dispatch) => {
    const paymentService = new PaymentService();
    
    try {
      dispatch({ type: PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_START });
      
      const isValid = await withRetry(() =>
        paymentService.verifyBlockchainTransaction(blockchainRef)
      );
      
      dispatch({
        type: PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_SUCCESS,
        payload: { blockchainRef, isValid }
      });
      
      return isValid;
    } catch (error) {
      dispatch({
        type: PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_FAILURE,
        error: error instanceof Error ? error : new Error('Blockchain verification failed')
      });
      throw error;
    }
  };
};

// Helper function to handle payment timeouts
const withTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Payment operation timed out')), timeout)
    )
  ]);
};

// Helper function to handle payment retries with exponential backoff
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Operation failed');
      if (attempt === maxAttempts) break;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw lastError!;
};