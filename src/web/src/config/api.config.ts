import axiosRetry from 'axios-retry';

/**
 * Current API version
 * @constant {string}
 */
export const API_VERSION = 'v1';

/**
 * Default API request timeout in milliseconds
 * @constant {number}
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default conditions that trigger request retries
 * @constant {string[]}
 */
export const RETRY_CONDITIONS = [
  'Network Error',
  'ECONNABORTED',
  '429',
  '500',
  '502',
  '503',
  '504'
];

/**
 * Interface defining comprehensive retry behavior for failed API requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  retryDelay: number;
  /** Exponential backoff multiplier */
  retryMultiplier: number;
  /** Array of error conditions that trigger retries */
  retryCondition: string[];
  /** Custom function to determine if request should be retried */
  shouldRetry: (error: any) => boolean;
}

/**
 * Interface defining comprehensive API configuration options
 */
export interface ApiConfig {
  /** Base URL for API endpoints */
  readonly baseURL: string;
  /** Request timeout in milliseconds */
  readonly timeout: number;
  /** Retry configuration */
  readonly retryConfig: RetryConfig;
  /** Default request headers */
  readonly headers: Record<string, string>;
  /** Custom status validation function */
  readonly validateStatus: (status: number) => boolean;
  /** Cross-origin credentials flag */
  readonly withCredentials: boolean;
  /** CSRF cookie name */
  readonly xsrfCookieName: string;
  /** CSRF header name */
  readonly xsrfHeaderName: string;
}

/**
 * Environment-specific base URLs
 */
const getBaseUrl = (): string => {
  switch (process.env.NODE_ENV) {
    case 'production':
      return 'https://api.myelixir.com/api/v1';
    case 'staging':
      return 'https://staging-api.myelixir.com/api/v1';
    default:
      return 'http://localhost:3000/api/v1';
  }
};

/**
 * Custom retry condition evaluator
 */
const shouldRetryRequest = (error: any): boolean => {
  const { config, code, response } = error;
  
  // Don't retry if we have no config (not an axios error)
  if (!config) return false;

  // Don't retry non-idempotent methods unless explicitly enabled
  if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
    return false;
  }

  // Retry on network errors
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;

  // Retry on specific status codes
  if (response && RETRY_CONDITIONS.includes(response.status.toString())) return true;

  return false;
};

/**
 * Comprehensive API configuration with security and monitoring capabilities
 */
export const apiConfig: ApiConfig = {
  baseURL: getBaseUrl(),
  timeout: DEFAULT_TIMEOUT,
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    retryMultiplier: 2,
    retryCondition: RETRY_CONDITIONS,
    shouldRetry: shouldRetryRequest
  },
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Version': API_VERSION,
    'X-Request-ID': '${uuid}', // Will be replaced with actual UUID per request
    // Security Headers
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    // Cache Control Headers
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache'
  },
  validateStatus: (status: number): boolean => {
    // Consider only 2xx status codes as successful
    return status >= 200 && status < 300;
  },
  withCredentials: true, // Enable cross-origin credentials
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN'
};

/**
 * Default export of the API configuration
 */
export default apiConfig;