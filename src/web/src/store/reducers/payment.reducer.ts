import { createReducer } from '@reduxjs/toolkit';
import { PaymentIntent } from '@stripe/stripe-js';
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
    .addCase(PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_SUCCESS, (state, { payload }) => {
      state.loadingStates.paymentInitialization = false;
      state.currentPaymentIntent = payload;
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `SUCCESS_${payload.id}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.INITIALIZE_PAYMENT_FAILURE, (state, { payload }) => {
      state.loadingStates.paymentInitialization = false;
      state.error = payload;
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
    .addCase(PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_SUCCESS, (state, { payload }) => {
      state.loadingStates.paymentProcessing = false;
      state.transactions = [...state.transactions, payload];
      state.currentVerification = {
        isValid: true,
        ref: payload.blockchainRef,
        txHash: payload.blockchainTxHash,
        timestamp: new Date()
      };
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `PROCESS_${payload.transactionId}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.PROCESS_PAYMENT_FAILURE, (state, { payload }) => {
      state.loadingStates.paymentProcessing = false;
      state.error = payload;
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
    .addCase(PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_SUCCESS, (state, { payload }) => {
      state.loadingStates.blockchainVerification = false;
      state.currentVerification = {
        isValid: payload.isValid,
        ref: payload.blockchainRef,
        txHash: payload.txHash,
        timestamp: new Date()
      };
      
      // Update transaction verification status if found
      if (state.selectedTransaction && 
          state.selectedTransaction.blockchainRef === payload.blockchainRef) {
        state.selectedTransaction = {
          ...state.selectedTransaction,
          blockchainTxHash: payload.txHash
        };
      }
    })
    .addCase(PAYMENT_ACTION_TYPES.VERIFY_BLOCKCHAIN_FAILURE, (state, { payload }) => {
      state.loadingStates.blockchainVerification = false;
      state.error = payload;
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
    .addCase(PAYMENT_ACTION_TYPES.FETCH_HISTORY_SUCCESS, (state, { payload }) => {
      state.loadingStates.historyFetch = false;
      state.transactions = payload;
      state.complianceStatus = {
        ...state.complianceStatus!,
        lastVerified: new Date(),
        auditId: `HISTORY_${Date.now()}`
      };
    })
    .addCase(PAYMENT_ACTION_TYPES.FETCH_HISTORY_FAILURE, (state, { payload }) => {
      state.loadingStates.historyFetch = false;
      state.error = payload;
    });
});

export default paymentReducer;