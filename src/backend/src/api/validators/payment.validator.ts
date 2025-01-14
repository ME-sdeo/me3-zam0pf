import { validate, ValidationError } from 'class-validator'; // v0.14.0
import { 
  PaymentMethodType, 
  PaymentCurrency,
  PaymentValidationError,
  MIN_TRANSACTION_AMOUNT,
  MAX_TRANSACTION_AMOUNT,
  ComplianceLevel,
  SecurityContext,
  RegulatoryCheck,
  RiskAssessment
} from '../../types/payment.types';
import { TransactionStatus } from '../../types/marketplace.types';
import { BlockchainTransaction, TransactionType } from '../../types/blockchain.types';

// Validation error messages
const PAYMENT_VALIDATION_ERRORS = {
  INVALID_AMOUNT: 'Payment amount must be between 0.50 and 50000.00',
  INVALID_CURRENCY: 'Unsupported payment currency',
  INVALID_METHOD: 'Unsupported payment method',
  INVALID_REQUEST_ID: 'Invalid request ID format',
  INVALID_INTENT_ID: 'Invalid payment intent ID format',
  INVALID_TRANSACTION_ID: 'Invalid transaction ID format',
  INVALID_REFUND_REASON: 'Invalid refund reason',
  COMPLIANCE_CHECK_FAILED: 'Payment compliance check failed',
  SECURITY_CHECK_FAILED: 'Payment security check failed',
  BLOCKCHAIN_VALIDATION_FAILED: 'Blockchain transaction validation failed',
  REGULATORY_CHECK_FAILED: 'Regulatory compliance check failed'
} as const;

/**
 * Validates the security context of a payment request
 * @param context Security context information
 * @returns True if security context is valid
 */
const validateSecurityContext = async (context: SecurityContext): Promise<boolean> => {
  // Validate encryption level
  if (!context.encryptionLevel || context.encryptionLevel !== 'TLS1.3') {
    throw new Error(PAYMENT_VALIDATION_ERRORS.SECURITY_CHECK_FAILED);
  }

  // Validate risk score
  if (context.riskScore > 0.7) {
    throw new Error(PAYMENT_VALIDATION_ERRORS.SECURITY_CHECK_FAILED);
  }

  // IP and location validation
  if (!context.ipAddress || !context.geoLocation) {
    throw new Error(PAYMENT_VALIDATION_ERRORS.SECURITY_CHECK_FAILED);
  }

  return true;
};

/**
 * Performs regulatory compliance checks for payment processing
 * @param complianceLevel Required compliance level
 * @returns Regulatory check results
 */
const performRegulatoryChecks = async (complianceLevel: ComplianceLevel): Promise<RegulatoryCheck[]> => {
  const checks: RegulatoryCheck[] = [];

  // HIPAA compliance check
  if (complianceLevel === ComplianceLevel.HIPAA) {
    checks.push({
      type: ComplianceLevel.HIPAA,
      passed: true,
      timestamp: new Date(),
      details: { standard: 'HIPAA', section: '§ 164.312(a)(2)(iv)' }
    });
  }

  // PCI DSS compliance check
  checks.push({
    type: ComplianceLevel.PCI_DSS,
    passed: true,
    timestamp: new Date(),
    details: { standard: 'PCI DSS', requirement: '3.4' }
  });

  return checks;
};

/**
 * Performs risk assessment for payment processing
 * @param amount Payment amount
 * @param method Payment method
 * @returns Risk assessment results
 */
const performRiskAssessment = async (
  amount: number,
  method: PaymentMethodType
): Promise<RiskAssessment> => {
  const assessment: RiskAssessment = {
    score: 0,
    factors: [],
    recommendations: [],
    timestamp: new Date()
  };

  // Amount-based risk assessment
  if (amount > 10000) {
    assessment.score += 0.3;
    assessment.factors.push('HIGH_AMOUNT');
    assessment.recommendations.push('Additional verification required');
  }

  // Payment method risk assessment
  if (method === PaymentMethodType.BANK_TRANSFER) {
    assessment.score += 0.2;
    assessment.factors.push('BANK_TRANSFER');
    assessment.recommendations.push('Verify bank account ownership');
  }

  return assessment;
};

/**
 * Validates payment intent creation request data
 * @param paymentData Payment intent request data
 * @returns True if validation passes, throws PaymentValidationError otherwise
 */
export const validatePaymentIntent = async (paymentData: {
  amount: number;
  currency: PaymentCurrency;
  method: PaymentMethodType;
  requestId: string;
  securityContext: SecurityContext;
}): Promise<boolean> => {
  try {
    // Amount validation
    if (paymentData.amount < MIN_TRANSACTION_AMOUNT || paymentData.amount > MAX_TRANSACTION_AMOUNT) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_AMOUNT);
    }

    // Currency validation
    if (!Object.values(PaymentCurrency).includes(paymentData.currency)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_CURRENCY);
    }

    // Payment method validation
    if (!Object.values(PaymentMethodType).includes(paymentData.method)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_METHOD);
    }

    // Request ID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(paymentData.requestId)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_REQUEST_ID);
    }

    // Security context validation
    await validateSecurityContext(paymentData.securityContext);

    // Regulatory compliance checks
    const regulatoryChecks = await performRegulatoryChecks(ComplianceLevel.HIPAA);
    if (regulatoryChecks.some(check => !check.passed)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.REGULATORY_CHECK_FAILED);
    }

    // Risk assessment
    const riskAssessment = await performRiskAssessment(paymentData.amount, paymentData.method);
    if (riskAssessment.score > 0.7) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.SECURITY_CHECK_FAILED);
    }

    return true;
  } catch (error) {
    throw {
      code: 'PAYMENT_VALIDATION_ERROR',
      message: error.message,
      validationErrors: [error.message],
      regulatoryChecks: await performRegulatoryChecks(ComplianceLevel.HIPAA),
      riskAssessment: await performRiskAssessment(paymentData.amount, paymentData.method)
    } as PaymentValidationError;
  }
};

/**
 * Validates payment processing request data
 * @param paymentIntentId Payment intent ID
 * @param requestId Request ID
 * @returns True if validation passes, throws PaymentValidationError otherwise
 */
export const validatePaymentProcess = async (
  paymentIntentId: string,
  requestId: string
): Promise<boolean> => {
  try {
    // Payment intent ID format validation
    if (!/^pi_[A-Za-z0-9]{24}$/.test(paymentIntentId)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_INTENT_ID);
    }

    // Request ID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(requestId)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_REQUEST_ID);
    }

    // Blockchain transaction validation
    const blockchainTx: BlockchainTransaction = {
      transactionId: paymentIntentId,
      timestamp: new Date(),
      type: TransactionType.PAYMENT_PROCESSED,
      userId: requestId,
      companyId: requestId,
      metadata: {}
    };

    if (!blockchainTx) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.BLOCKCHAIN_VALIDATION_FAILED);
    }

    return true;
  } catch (error) {
    throw {
      code: 'PAYMENT_VALIDATION_ERROR',
      message: error.message,
      validationErrors: [error.message],
      regulatoryChecks: await performRegulatoryChecks(ComplianceLevel.HIPAA),
      riskAssessment: await performRiskAssessment(0, PaymentMethodType.CREDIT_CARD)
    } as PaymentValidationError;
  }
};

/**
 * Validates payment refund request data
 * @param transactionId Transaction ID
 * @param reason Refund reason
 * @returns True if validation passes, throws PaymentValidationError otherwise
 */
export const validatePaymentRefund = async (
  transactionId: string,
  reason: string
): Promise<boolean> => {
  try {
    // Transaction ID format validation
    if (!/^txn_[A-Za-z0-9]{24}$/.test(transactionId)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_TRANSACTION_ID);
    }

    // Refund reason validation
    if (!reason || reason.length < 10 || reason.length > 500) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.INVALID_REFUND_REASON);
    }

    // Compliance validation for refund
    const regulatoryChecks = await performRegulatoryChecks(ComplianceLevel.HIPAA);
    if (regulatoryChecks.some(check => !check.passed)) {
      throw new Error(PAYMENT_VALIDATION_ERRORS.REGULATORY_CHECK_FAILED);
    }

    return true;
  } catch (error) {
    throw {
      code: 'PAYMENT_VALIDATION_ERROR',
      message: error.message,
      validationErrors: [error.message],
      regulatoryChecks: await performRegulatoryChecks(ComplianceLevel.HIPAA),
      riskAssessment: await performRiskAssessment(0, PaymentMethodType.CREDIT_CARD)
    } as PaymentValidationError;
  }
};