import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.3.0
import axiosRetry from 'axios-retry'; // ^3.4.0
import { v4 as uuidv4 } from 'uuid';
import { apiConfig } from '../config/api.config';
import { HTTP_HEADERS, HTTP_STATUS, CONTENT_TYPES } from '../constants/api.constants';

/**
 * Interface for FHIR validation errors
 */
interface FHIRValidationError {
  path: string;
  severity: 'error' | 'warning';
  message: string;
  code: string;
}

/**
 * Enhanced interface for standardized API error format
 */
export interface ApiError {
  status: number;
  message: string;
  code: string;
  details?: Record<string, any>;
  fhirValidation?: FHIRValidationError[];
  blockchainTxHash?: string;
  correlationId: string;
}

/**
 * Enhanced interface for API request configuration
 */
export interface RequestConfig extends AxiosRequestConfig {
  fhirResourceType?: string;
  validateFHIR?: boolean;
  blockchainEnabled?: boolean;
}

/**
 * Creates and configures an axios instance with enhanced FHIR and HIPAA compliance features
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    headers: apiConfig.headers,
    validateStatus: apiConfig.validateStatus,
    withCredentials: apiConfig.withCredentials,
    xsrfCookieName: apiConfig.xsrfCookieName,
    xsrfHeaderName: apiConfig.xsrfHeaderName
  });

  // Configure retry mechanism
  axiosRetry(instance, {
    retries: apiConfig.retryConfig.maxRetries,
    retryDelay: (retryCount) => {
      return retryCount * apiConfig.retryConfig.retryDelay * apiConfig.retryConfig.retryMultiplier;
    },
    retryCondition: apiConfig.retryConfig.shouldRetry
  });

  // Request interceptor for auth and correlation ID
  instance.interceptors.request.use((config) => {
    const correlationId = uuidv4();
    config.headers = config.headers || {};
    config.headers[HTTP_HEADERS.X_CORRELATION_ID] = correlationId;

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers[HTTP_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
    }

    // Handle FHIR content type
    if ((config as RequestConfig).fhirResourceType) {
      config.headers[HTTP_HEADERS.CONTENT_TYPE] = CONTENT_TYPES.FHIR_JSON;
      config.headers[HTTP_HEADERS.ACCEPT] = CONTENT_TYPES.FHIR_JSON;
    }

    return config;
  });

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Handle rate limiting headers
      const rateLimitRemaining = response.headers[HTTP_HEADERS.X_RATE_LIMIT_REMAINING];
      if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
        console.warn('Rate limit threshold approaching');
      }

      return response;
    },
    (error: AxiosError) => {
      return Promise.reject(formatApiError(error));
    }
  );

  return instance;
};

/**
 * Enhanced error formatting with FHIR validation and blockchain support
 */
const formatApiError = (error: AxiosError): ApiError => {
  const correlationId = error.config?.headers?.[HTTP_HEADERS.X_CORRELATION_ID] as string || uuidv4();
  
  const baseError: ApiError = {
    status: error.response?.status || HTTP_STATUS.INTERNAL_ERROR,
    message: 'An error occurred processing your request',
    code: 'UNKNOWN_ERROR',
    correlationId
  };

  if (!error.response) {
    baseError.code = 'NETWORK_ERROR';
    baseError.message = 'Network error occurred';
    return baseError;
  }

  const responseData = error.response.data as any;

  // Handle FHIR validation errors
  if (responseData?.fhirValidation) {
    baseError.fhirValidation = responseData.fhirValidation;
    baseError.code = 'FHIR_VALIDATION_ERROR';
  }

  // Handle blockchain transaction errors
  if (responseData?.blockchainTxHash) {
    baseError.blockchainTxHash = responseData.blockchainTxHash;
    baseError.code = 'BLOCKCHAIN_ERROR';
  }

  // Handle specific error cases
  switch (error.response.status) {
    case HTTP_STATUS.UNAUTHORIZED:
      baseError.code = 'UNAUTHORIZED';
      baseError.message = 'Authentication required';
      break;
    case HTTP_STATUS.FORBIDDEN:
      baseError.code = 'FORBIDDEN';
      baseError.message = 'Access denied';
      break;
    case HTTP_STATUS.NOT_FOUND:
      baseError.code = 'NOT_FOUND';
      baseError.message = 'Resource not found';
      break;
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      baseError.code = 'RATE_LIMIT_EXCEEDED';
      baseError.message = 'Rate limit exceeded';
      break;
    default:
      if (responseData?.message) {
        baseError.message = responseData.message;
      }
      if (responseData?.code) {
        baseError.code = responseData.code;
      }
  }

  // Add additional error details if available
  if (responseData?.details) {
    baseError.details = responseData.details;
  }

  // Log error for monitoring
  console.error('API Error:', {
    correlationId,
    status: baseError.status,
    code: baseError.code,
    message: baseError.message
  });

  return baseError;
};

// Create and export the configured axios instance
export const axiosInstance = createAxiosInstance();

export default axiosInstance;