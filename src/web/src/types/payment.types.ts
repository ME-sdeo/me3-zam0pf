import { TransactionStatus } from './marketplace.types';

/**
 * Enumeration of supported payment method types with PCI-compliant implementations
 * Ensures secure payment processing across multiple payment methods
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

/**
 * Enumeration of supported payment currencies for international transactions
 * Follows ISO 4217 currency codes
 */
export enum PaymentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

/**
 * Type definition for payment amount with currency and validation constraints
 * Ensures proper monetary value handling with currency context
 */
export type PaymentAmount = {
  value: number;
  currency: PaymentCurrency;
};

/**
 * Enhanced type definition for payment method details with improved security and validation
 * Implements PCI-DSS compliant payment method handling
 */
export type PaymentMethod = {
  id: string;
  type: PaymentMethodType;
  last4: string;
  brand: string;
  expiryDate: Date;
};

/**
 * Comprehensive type definition for payment transaction records with blockchain integration
 * Supports transparent and immutable transaction tracking
 */
export type PaymentTransaction = {
  transactionId: string;
  requestId: string;
  amount: PaymentAmount;
  paymentMethod: PaymentMethodType;
  status: TransactionStatus;
  createdAt: Date;
  blockchainRef: string;
  metadata: Record<string, unknown>;
};

/**
 * Type definition for payment history records with aggregation support
 * Enables comprehensive transaction history tracking and reporting
 */
export type PaymentHistory = {
  transactions: PaymentTransaction[];
  totalAmount: number;
  startDate: Date;
  endDate: Date;
};

/**
 * Global constants for payment processing configuration
 * Defines system-wide payment processing constraints
 */
export const DEFAULT_CURRENCY = PaymentCurrency.USD;
export const MIN_PAYMENT_AMOUNT = 0.5;
export const MAX_PAYMENT_AMOUNT = 50000.0;

/**
 * Type guard to validate PaymentAmount objects
 * Ensures payment amounts are within valid ranges and use supported currencies
 */
export const isValidPaymentAmount = (amount: unknown): amount is PaymentAmount => {
  if (!amount || typeof amount !== 'object') {
    return false;
  }

  const paymentAmount = amount as Partial<PaymentAmount>;
  return (
    typeof paymentAmount.value === 'number' &&
    paymentAmount.value >= MIN_PAYMENT_AMOUNT &&
    paymentAmount.value <= MAX_PAYMENT_AMOUNT &&
    Object.values(PaymentCurrency).includes(paymentAmount.currency as PaymentCurrency)
  );
};

/**
 * Type guard to validate PaymentTransaction objects
 * Ensures transaction records contain all required fields with proper types
 */
export const isValidPaymentTransaction = (transaction: unknown): transaction is PaymentTransaction => {
  if (!transaction || typeof transaction !== 'object') {
    return false;
  }

  const tx = transaction as Partial<PaymentTransaction>;
  return (
    typeof tx.transactionId === 'string' &&
    typeof tx.requestId === 'string' &&
    isValidPaymentAmount(tx.amount) &&
    Object.values(PaymentMethodType).includes(tx.paymentMethod as PaymentMethodType) &&
    Object.values(TransactionStatus).includes(tx.status as TransactionStatus) &&
    tx.createdAt instanceof Date &&
    typeof tx.blockchainRef === 'string'
  );
};

/**
 * Type guard to validate PaymentMethod objects
 * Ensures payment method details are complete and properly formatted
 */
export const isValidPaymentMethod = (method: unknown): method is PaymentMethod => {
  if (!method || typeof method !== 'object') {
    return false;
  }

  const paymentMethod = method as Partial<PaymentMethod>;
  return (
    typeof paymentMethod.id === 'string' &&
    Object.values(PaymentMethodType).includes(paymentMethod.type as PaymentMethodType) &&
    typeof paymentMethod.last4 === 'string' &&
    paymentMethod.last4.length === 4 &&
    typeof paymentMethod.brand === 'string' &&
    paymentMethod.expiryDate instanceof Date
  );
};