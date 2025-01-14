/**
 * @file Error constants for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Defines standardized error codes, messages and HTTP status codes
 * with HIPAA compliance and monitoring integration
 */

/**
 * Enumeration of all possible error codes in the system
 * Used for type-safe error handling and monitoring
 */
export enum ErrorCode {
  AUTH_001 = 'AUTH_001',
  AUTH_002 = 'AUTH_002',
  FHIR_001 = 'FHIR_001', 
  FHIR_002 = 'FHIR_002',
  CONS_001 = 'CONS_001',
  CONS_002 = 'CONS_002',
  PAY_001 = 'PAY_001',
  SYS_001 = 'SYS_001'
}

/**
 * Enumeration of error categories for monitoring and reporting
 * Used to group related errors for analytics
 */
export enum ErrorCategory {
  AUTH = 'AUTH',
  FHIR = 'FHIR',
  CONS = 'CONS',
  PAY = 'PAY',
  SYS = 'SYS'
}

/**
 * HIPAA-compliant error messages mapped to error codes
 * Messages are designed to be informative while avoiding exposure of sensitive data
 */
export const ERROR_MESSAGES: { [key in ErrorCode]: string } = {
  [ErrorCode.AUTH_001]: 'Authentication failed: Invalid credentials provided',
  [ErrorCode.AUTH_002]: 'Authentication failed: Security token has expired',
  [ErrorCode.FHIR_001]: 'Invalid FHIR resource: Resource validation failed',
  [ErrorCode.FHIR_002]: 'FHIR resource not found in the system',
  [ErrorCode.CONS_001]: 'Invalid consent: Required permissions are missing or invalid',
  [ErrorCode.CONS_002]: 'Consent has expired or has been revoked',
  [ErrorCode.PAY_001]: 'Payment processing failed: Transaction could not be completed',
  [ErrorCode.SYS_001]: 'System is currently experiencing high load: Please retry later'
} as const;

/**
 * HTTP status codes mapped to error categories
 * Used for standardized HTTP responses across the application
 */
export const ERROR_STATUS_CODES: { [key in ErrorCategory]: number } = {
  [ErrorCategory.AUTH]: 401, // Unauthorized
  [ErrorCategory.FHIR]: 400, // Bad Request
  [ErrorCategory.CONS]: 403, // Forbidden
  [ErrorCategory.PAY]: 402,  // Payment Required
  [ErrorCategory.SYS]: 503   // Service Unavailable
} as const;

/**
 * Type guard to check if a string is a valid ErrorCode
 * @param code - The code to check
 * @returns boolean indicating if code is a valid ErrorCode
 */
export const isErrorCode = (code: string): code is ErrorCode => {
  return Object.values(ErrorCode).includes(code as ErrorCode);
};

/**
 * Type guard to check if a string is a valid ErrorCategory
 * @param category - The category to check
 * @returns boolean indicating if category is a valid ErrorCategory
 */
export const isErrorCategory = (category: string): category is ErrorCategory => {
  return Object.values(ErrorCategory).includes(category as ErrorCategory);
};

/**
 * Gets the category for a given error code
 * @param code - The error code
 * @returns The corresponding ErrorCategory
 */
export const getErrorCategory = (code: ErrorCode): ErrorCategory => {
  const category = code.split('_')[0];
  if (isErrorCategory(category)) {
    return category;
  }
  return ErrorCategory.SYS; // Default to system error if category cannot be determined
};

/**
 * Gets the HTTP status code for a given error code
 * @param code - The error code
 * @returns The corresponding HTTP status code
 */
export const getHttpStatusCode = (code: ErrorCode): number => {
  const category = getErrorCategory(code);
  return ERROR_STATUS_CODES[category];
};

/**
 * Gets the error message for a given error code
 * @param code - The error code
 * @returns The corresponding error message
 */
export const getErrorMessage = (code: ErrorCode): string => {
  return ERROR_MESSAGES[code];
};