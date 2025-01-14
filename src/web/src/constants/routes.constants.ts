/**
 * Route path constants for MyElixir healthcare data marketplace platform
 * Defines type-safe route paths using TypeScript const assertions
 * @version 1.0.0
 */

/**
 * Public authentication routes accessible without login
 * Includes paths for login, registration, password reset and MFA verification
 */
export const PUBLIC_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register', 
  RESET_PASSWORD: '/reset-password',
  VERIFY_MFA: '/verify-mfa'
} as const;

/**
 * Protected company portal routes
 * Requires authenticated company user access
 * Includes dashboard, data requests, analytics and settings
 */
export const COMPANY_ROUTES = {
  BASE: '/company',
  DASHBOARD: '/company/dashboard',
  DATA_REQUESTS: '/company/requests',
  REQUEST_DETAILS: '/company/requests/:requestId',
  ANALYTICS: '/company/analytics',
  BILLING: '/company/billing',
  SETTINGS: '/company/settings'
} as const;

/**
 * Protected consumer portal routes
 * Requires authenticated consumer user access
 * Includes dashboard, health records, consent management and settings
 */
export const CONSUMER_ROUTES = {
  BASE: '/consumer',
  DASHBOARD: '/consumer/dashboard',
  HEALTH_RECORDS: '/consumer/health-records',
  RECORD_DETAILS: '/consumer/health-records/:recordId',
  CONSENT_MANAGEMENT: '/consumer/consent',
  COMPENSATION: '/consumer/compensation',
  SETTINGS: '/consumer/settings'
} as const;

/**
 * Error and fallback routes
 * Handles various error scenarios and invalid routes
 */
export const ERROR_ROUTES = {
  NOT_FOUND: '*',
  SERVER_ERROR: '/server-error',
  UNAUTHORIZED: '/unauthorized',
  FORBIDDEN: '/forbidden'
} as const;

// Type definitions for route parameters
export type RequestIdParam = {
  requestId: string;
};

export type RecordIdParam = {
  recordId: string;
};

// Type definitions for route paths
export type PublicRoutePath = typeof PUBLIC_ROUTES[keyof typeof PUBLIC_ROUTES];
export type CompanyRoutePath = typeof COMPANY_ROUTES[keyof typeof COMPANY_ROUTES];
export type ConsumerRoutePath = typeof CONSUMER_ROUTES[keyof typeof CONSUMER_ROUTES];
export type ErrorRoutePath = typeof ERROR_ROUTES[keyof typeof ERROR_ROUTES];

// Combined route path type
export type AppRoutePath = 
  | PublicRoutePath 
  | CompanyRoutePath 
  | ConsumerRoutePath 
  | ErrorRoutePath;