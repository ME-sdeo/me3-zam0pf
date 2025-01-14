/**
 * @file Error handling utility for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Provides standardized error handling with HIPAA compliance and security features
 */

import { ERROR_MESSAGES, ERROR_STATUS_CODES } from '../constants/error.constants';
import { logger } from './logger.util';

/**
 * Base error class with enhanced security and tracking features
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly metadata: Record<string, any>;
  public readonly correlationId: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.correlationId = correlationId;
    this.name = this.constructor.name;
    this.isOperational = true;

    // Log error with correlation ID for tracking
    logger.error(message, {
      errorCode: code,
      statusCode,
      correlationId,
      metadata: this.sanitizeMetadata(metadata)
    });

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Sanitizes error metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'ssn', 'healthRecord'];
    const sanitized = { ...metadata };
    
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}

/**
 * Authentication error class for handling auth-related errors
 */
export class AuthenticationError extends BaseError {
  constructor(
    code: string,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(
      ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES],
      code,
      ERROR_STATUS_CODES.AUTH,
      metadata,
      correlationId
    );
  }
}

/**
 * FHIR error class for handling FHIR-related errors
 */
export class FHIRError extends BaseError {
  constructor(
    code: string,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(
      ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES],
      code,
      ERROR_STATUS_CODES.FHIR,
      metadata,
      correlationId
    );
  }
}

/**
 * Consent error class for handling consent-related errors
 */
export class ConsentError extends BaseError {
  constructor(
    code: string,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(
      ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES],
      code,
      ERROR_STATUS_CODES.CONS,
      metadata,
      correlationId
    );
  }
}

/**
 * Payment error class for handling payment-related errors
 */
export class PaymentError extends BaseError {
  constructor(
    code: string,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(
      ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES],
      code,
      ERROR_STATUS_CODES.PAY,
      metadata,
      correlationId
    );
  }
}

/**
 * System error class for handling system-level errors
 */
export class SystemError extends BaseError {
  constructor(
    code: string,
    metadata: Record<string, any> = {},
    correlationId: string
  ) {
    super(
      ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES],
      code,
      ERROR_STATUS_CODES.SYS,
      metadata,
      correlationId
    );
  }
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  metadata: Record<string, any> = {},
  correlationId: string
): Record<string, any> {
  return {
    error: {
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      metadata: metadata,
      status: statusCode
    }
  };
}

/**
 * Global error handler for processing and formatting error responses
 */
export function handleError(
  error: Error,
  request: any,
  response: any
): Record<string, any> {
  const correlationId = request.headers['x-correlation-id'] || 'unknown';
  
  // Handle known errors
  if (error instanceof BaseError) {
    return createErrorResponse(
      error.code,
      error.message,
      error.statusCode,
      error.metadata,
      correlationId
    );
  }

  // Handle unknown errors
  const systemError = new SystemError(
    'SYS_001',
    { originalError: error.message },
    correlationId
  );

  return createErrorResponse(
    systemError.code,
    systemError.message,
    systemError.statusCode,
    systemError.metadata,
    correlationId
  );
}

export default {
  BaseError,
  AuthenticationError,
  FHIRError,
  ConsentError,
  PaymentError,
  SystemError,
  handleError,
  createErrorResponse
};