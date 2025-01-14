/**
 * API Constants for MyElixir Platform
 * Defines comprehensive HTTP-related constants for secure communication between frontend and backend services
 * @version 1.0.0
 */

/**
 * HTTP header constants for request/response headers
 * Includes security, tracing and rate limiting headers
 */
export const HTTP_HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  X_API_KEY: 'X-Api-Key',
  X_REQUEST_ID: 'X-Request-Id',
  X_CORRELATION_ID: 'X-Correlation-Id',
  X_RATE_LIMIT: 'X-Rate-Limit',
  X_RATE_LIMIT_REMAINING: 'X-Rate-Limit-Remaining',
  X_RATE_LIMIT_RESET: 'X-Rate-Limit-Reset'
} as const;

/**
 * HTTP status codes for all possible API responses
 * Includes success, client error and server error codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Content type constants including FHIR-specific types
 * Supports various data formats used in the platform
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FHIR_JSON: 'application/fhir+json',
  FORM_DATA: 'multipart/form-data',
  STREAM: 'application/octet-stream',
  PDF: 'application/pdf'
} as const;

/**
 * API endpoint constants for all system functionalities
 * Organized by feature domain for better maintainability
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    MFA_SETUP: '/auth/mfa/setup',
    MFA_VERIFY: '/auth/mfa/verify',
    MFA_RECOVERY: '/auth/mfa/recovery',
    PASSWORD_RESET: '/auth/password/reset',
    PASSWORD_CHANGE: '/auth/password/change'
  },

  FHIR: {
    UPLOAD: '/fhir/upload',
    VALIDATE: '/fhir/validate',
    RESOURCE: '/fhir/resource',
    SEARCH: '/fhir/search',
    HISTORY: '/fhir/history',
    METADATA: '/fhir/metadata',
    BATCH: '/fhir/batch',
    TRANSACTION: '/fhir/transaction'
  },

  MARKETPLACE: {
    REQUESTS: '/marketplace/requests',
    MATCHES: '/marketplace/matches',
    PRICING: '/marketplace/pricing',
    ANALYTICS: '/marketplace/analytics',
    RECOMMENDATIONS: '/marketplace/recommendations',
    NOTIFICATIONS: '/marketplace/notifications'
  },

  CONSENT: {
    GRANT: '/consent/grant',
    REVOKE: '/consent/revoke',
    STATUS: '/consent/status',
    HISTORY: '/consent/history',
    VERIFY: '/consent/verify',
    AUDIT: '/consent/audit'
  },

  PAYMENT: {
    PROCESS: '/payment/process',
    VERIFY: '/payment/verify',
    HISTORY: '/payment/history',
    REFUND: '/payment/refund',
    BALANCE: '/payment/balance',
    METHODS: '/payment/methods'
  },

  BLOCKCHAIN: {
    TRANSACTION: '/blockchain/transaction',
    VERIFY: '/blockchain/verify',
    STATUS: '/blockchain/status',
    HISTORY: '/blockchain/history'
  }
} as const;

// Type exports for TypeScript support
export type HttpHeaders = typeof HTTP_HEADERS;
export type HttpStatus = typeof HTTP_STATUS;
export type ContentTypes = typeof CONTENT_TYPES;
export type ApiEndpoints = typeof API_ENDPOINTS;