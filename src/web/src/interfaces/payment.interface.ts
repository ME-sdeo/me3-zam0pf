import { PaymentIntent, PaymentMethod } from '@stripe/stripe-js'; // @stripe/stripe-js ^1.54.0
import { TransactionStatus } from '../types/marketplace.types';

/**
 * Enumeration of supported payment method types in the marketplace
 * Supports multiple payment options for global accessibility
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WIRE_TRANSFER = 'WIRE_TRANSFER',
  ACH = 'ACH'
}

/**
 * Enumeration of supported currencies in the marketplace
 * Enables global marketplace operations with multi-currency support
 */
export enum PaymentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CAD = 'CAD',
  AUD = 'AUD'
}

/**
 * Global payment configuration constants
 */
export const DEFAULT_CURRENCY = PaymentCurrency.USD;
export const MIN_PAYMENT_AMOUNT = 0.5;
export const MAX_PAYMENT_AMOUNT = 50000.0;
export const BLOCKCHAIN_CONFIRMATION_BLOCKS = 12;
export const PAYMENT_TIMEOUT_MS = 30000;
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Interface defining payment method structure with comprehensive validation
 */
export interface IPaymentMethod {
  id: string;
  type: PaymentMethodType;
  last4: string;
  brand: string;
  expiryDate: Date;
  isDefault: boolean;
  billingAddress: string;
  postalCode: string;
  country: string;
}

/**
 * Interface defining payment amount structure with currency support
 */
export interface IPaymentAmount {
  value: number;
  currency: PaymentCurrency;
  exchangeRate: number;
  exchangeRateTimestamp: Date;
  isRefundable: boolean;
}

/**
 * Interface defining payment transaction structure with blockchain integration
 */
export interface IPaymentTransaction {
  transactionId: string;
  requestId: string;
  amount: IPaymentAmount;
  paymentMethod: PaymentMethodType;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
  blockchainRef: string;
  blockchainTxHash: string;
  metadata: {
    requestType: string;
    dataProvider: string;
    dataConsumer: string;
    recordCount: number;
    consentId: string;
  };
  errorCode?: string;
  errorMessage?: string;
  paymentGatewayResponse: {
    gatewayTransactionId: string;
    paymentIntent?: PaymentIntent;
    paymentMethod?: PaymentMethod;
    processorResponse?: {
      code: string;
      message: string;
      avsResult?: string;
      cvvResult?: string;
    };
  };
}

/**
 * Type guard to validate payment method objects
 */
export const isValidPaymentMethod = (method: unknown): method is IPaymentMethod => {
  if (!method || typeof method !== 'object') {
    return false;
  }

  const paymentMethod = method as Partial<IPaymentMethod>;
  return (
    typeof paymentMethod.id === 'string' &&
    Object.values(PaymentMethodType).includes(paymentMethod.type as PaymentMethodType) &&
    typeof paymentMethod.last4 === 'string' &&
    typeof paymentMethod.brand === 'string' &&
    paymentMethod.expiryDate instanceof Date &&
    typeof paymentMethod.isDefault === 'boolean' &&
    typeof paymentMethod.billingAddress === 'string' &&
    typeof paymentMethod.postalCode === 'string' &&
    typeof paymentMethod.country === 'string'
  );
};

/**
 * Type guard to validate payment amount objects
 */
export const isValidPaymentAmount = (amount: unknown): amount is IPaymentAmount => {
  if (!amount || typeof amount !== 'object') {
    return false;
  }

  const paymentAmount = amount as Partial<IPaymentAmount>;
  return (
    typeof paymentAmount.value === 'number' &&
    paymentAmount.value >= MIN_PAYMENT_AMOUNT &&
    paymentAmount.value <= MAX_PAYMENT_AMOUNT &&
    Object.values(PaymentCurrency).includes(paymentAmount.currency as PaymentCurrency) &&
    typeof paymentAmount.exchangeRate === 'number' &&
    paymentAmount.exchangeRateTimestamp instanceof Date &&
    typeof paymentAmount.isRefundable === 'boolean'
  );
};

/**
 * Type guard to validate payment transaction objects
 */
export const isValidPaymentTransaction = (transaction: unknown): transaction is IPaymentTransaction => {
  if (!transaction || typeof transaction !== 'object') {
    return false;
  }

  const paymentTransaction = transaction as Partial<IPaymentTransaction>;
  return (
    typeof paymentTransaction.transactionId === 'string' &&
    typeof paymentTransaction.requestId === 'string' &&
    isValidPaymentAmount(paymentTransaction.amount) &&
    Object.values(PaymentMethodType).includes(paymentTransaction.paymentMethod as PaymentMethodType) &&
    Object.values(TransactionStatus).includes(paymentTransaction.status as TransactionStatus) &&
    paymentTransaction.createdAt instanceof Date &&
    paymentTransaction.updatedAt instanceof Date &&
    typeof paymentTransaction.blockchainRef === 'string' &&
    typeof paymentTransaction.blockchainTxHash === 'string' &&
    typeof paymentTransaction.metadata === 'object'
  );
};