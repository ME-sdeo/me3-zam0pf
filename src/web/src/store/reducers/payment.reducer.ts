import { createReducer } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^1.9.5
import { PaymentIntent } from '@stripe/stripe-js'; // @stripe/stripe-js ^1.54.0
import { PAYMENT_ACTION_TYPES } from '../actions/payment.actions';
import { IPaymentTransaction } from '../../interfaces/payment.interface';

// Interface for blockchain verification status
interface IBlockchainVerification {
  isValid: boolean;
  ref: string;
  txHash: string;
  timestamp: Date;
}

// Interface for HIPAA compliance metadata
interface IComplianceMetadata {
  auditId: string;
  complianceLevel: string;
  encryptionStatus: boolean;
  retentionPeriod: string;
  lastVerified: Date;
}

// Interface defining the shape of the payment reducer state
export interface IPaymentState {
  transactions: IPaymentTransaction[];
  currentPaymentIntent: PaymentIntent | null;
  isLoading: boolean;
  error: string | null;
  selectedTransaction: IPaymentTransaction | null;
  currentVerification: IBlockchainVerification | null;
  complianceStatus: IComplianceMetadata | null;
  loadingStates: {
    paymentInitialization: boolean;
    paymentProcessing: boolean;
    blockchainVerification: boolean;
    historyFetch: boolean;
    transactionFetch: boolean;
  };
}

// Initial state with HIPAA compliance and blockchain tracking
const INITIAL_STATE: IPaymentState = {
  transactions: [],
  currentPaymentIntent: null,
  isLoading: false,
  error: null,
  selectedTransaction: null,
  currentVerification: null,
  complianceStatus: null,
  loadingStates: {
    paymentInitialization: false,
    paymentProcessing: false,
    blockchainVerification: false,
    historyFetch: false,
    transactionFetch: false
  }
};

// Payment reducer with comprehensive HIPAA compliance and blockchain verification
export const paymentReducer = createReducer(INITIAL_STATE, (builder) => {
  builder
    // Payment Initialization
    .addCase(PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_START, (state) => {
      state.loadingStates.paymentInitialization = true;
      state.error = null;
      state.complianceStatus = {
        auditId: `INIT_${Date.now()}`,
        complianceLevel: 'HIPAA_FULL',
        encryptionStatus: true,
        retentionPeriod: '7_YEARS',
        lastVerified: new Date()
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_SUCCESS, (state, action) => {
      state.loadingStates.paymentInitialization = false;
      state.currentPaymentIntent = action.payload;
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `SUCCESS_${action.payload.id}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_FAILURE, (state, action) => {
      state.loadingStates.paymentInitialization = false;
      state.error = action.payload;
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `FAILURE_${Date.now()}`
      };
    })

    // Payment Processing
    .addCase(PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_START, (state) => {
      state.loadingStates.paymentProcessing = true;
      state.error = null;
      state.currentVerification = null;
    })
    .addCase(PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_SUCCESS, (state, action) => {
      state.loadingStates.paymentProcessing = false;
      state.transactions = [...state.transactions, action.payload];
      state.currentVerification = {
        isValid: true,
        ref: action.payload.blockchainRef,
        txHash: action.payload.blockchainTxHash,
        timestamp: new Date()
      };
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `PROCESS_${action.payload.transactionId}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_FAILURE, (state, action) => {
      state.loadingStates.paymentProcessing = false;
      state.error = action.payload;
      state.currentVerification = {
        isValid: false,
        ref: '',
        txHash: '',
        timestamp: new Date()
      };
    })

    // Blockchain Verification
    .addCase(PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_START, (state) => {
      state.loadingStates.blockchainVerification = true;
      state.error = null;
    })
    .addCase(PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_SUCCESS, (state, action) => {
      state.loadingStates.blockchainVerification = false;
      state.currentVerification = {
        isValid: action.payload.isValid,
        ref: action.payload.blockchainRef,
        txHash: action.payload.txHash,
        timestamp: new Date()
      };
      
      // Update transaction verification status if found
      if (state.selectedTransaction && 
          state.selectedTransaction.blockchainRef === action.payload.blockchainRef) {
        state.selectedTransaction = {
          ...state.selectedTransaction,
          blockchainTxHash: action.payload.txHash
        };
      }
    })
    .addCase(PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_FAILURE, (state, action) => {
      state.loadingStates.blockchainVerification = false;
      state.error = action.payload;
      state.currentVerification = {
        isValid: false,
        ref: '',
        txHash: '',
        timestamp: new Date()
      };
    })

    // Transaction History
    .addCase(PAYMENT_ACTION_TYPES.FETCH_HISTORY_START, (state) => {
      state.loadingStates.historyFetch = true;
      state.error = null;
    })
    .addCase(PAYMENT_ACTION_TYPES.FETCH_HISTORY_SUCCESS, (state, action) => {
      state.loadingStates.historyFetch = false;
      state.transactions = action.payload;
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `HISTORY_${Date.now()}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.FETCH_HISTORY_FAILURE, (state, action) => {
      state.loadingStates.historyFetch = false;
      state.error = action.payload;
    });
});

export default paymentReducer;