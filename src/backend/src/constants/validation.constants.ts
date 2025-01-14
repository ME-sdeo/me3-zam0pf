/**
 * Validation Constants for MyElixir Healthcare Data Marketplace
 * Implements comprehensive validation rules ensuring HIPAA compliance and security best practices
 */

/**
 * User validation constants enforcing HIPAA-compliant password policy
 * Requires minimum 12 characters with mixed case, numbers, and special characters
 */
export const USER_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
} as const;

/**
 * Email validation constants implementing RFC 5322 standard
 * Enforces proper email format with practical length restrictions
 */
export const EMAIL_VALIDATION = {
  EMAIL_PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  MAX_LENGTH: 254
} as const;

/**
 * FHIR resource validation constants ensuring FHIR R4 compliance
 * Implements strict validation rules with size limits for optimal performance
 */
export const FHIR_VALIDATION = {
  RESOURCE_TYPE_PATTERN: /^[A-Z][A-Za-z]+$/,
  ID_PATTERN: /^[A-Za-z0-9\-\.]{1,64}$/,
  VERSION_PATTERN: /^[0-9]+$/,
  MAX_RESOURCE_SIZE: 1048576 // 1MB limit for FHIR resources
} as const;

/**
 * Consent validation constants implementing HIPAA-compliant rules
 * Enforces appropriate time bounds and scope limitations for data sharing
 */
export const CONSENT_VALIDATION = {
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 365,
  SCOPE_PATTERN: /^[a-zA-Z0-9_\-\.]+$/,
  MAX_SCOPES: 10
} as const;

/**
 * Marketplace validation constants for secure transaction processing
 * Establishes reasonable bounds for pricing and quantity validation
 */
export const MARKETPLACE_VALIDATION = {
  MIN_PRICE: 0.01,
  MAX_PRICE: 10000.00,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 1000000
} as const;

/**
 * Phone number validation constants implementing E.164 standard
 * Ensures global compatibility for international phone numbers
 */
export const PHONE_VALIDATION = {
  PHONE_PATTERN: /^\+[1-9]\d{1,14}$/,
  MAX_LENGTH: 15
} as const;