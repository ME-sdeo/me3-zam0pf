import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // axios ^1.4.0
import axiosRetry from 'axios-retry'; // axios-retry ^3.4.0
import { setupCache, buildMemoryStorage } from 'axios-cache-adapter'; // axios-cache-adapter ^2.7.3
import { createLogger, format, transports } from 'winston'; // winston ^3.8.0
import { v4 as uuidv4 } from 'uuid'; // uuid ^9.0.0

import { apiConfig } from '../config/api.config';
import { isTokenValid, getStoredTokens } from '../utils/auth.util';
import { AuthError } from '../types/auth.types';

/**
 * Interface for API request configuration extending AxiosRequestConfig
 */
interface RequestConfig extends AxiosRequestConfig {
  skipCache?: boolean;
  skipRetry?: boolean;
  requiresAuth?: boolean;
}

/**
 * Interface for standardized API response
 */
interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cached?: boolean;
}

/**
 * HIPAA/GDPR-compliant API service implementing secure HTTP communications
 */
export class ApiService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: any;
  private readonly cache: any;

  constructor() {
    // Initialize HIPAA-compliant audit logger
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.File({ filename: 'api-audit.log' })
      ]
    });

    // Initialize request cache with security settings
    this.cache = setupCache({
      maxAge: 15 * 60 * 1000, // 15 minutes
      store: buildMemoryStorage(),
      exclude: {
        query: false,
        methods: ['POST', 'PUT', 'DELETE', 'PATCH']
      },
      key: (req: { url?: string; method?: string; headers?: any; params?: any }) => {
        const serialized = JSON.stringify({
          url: req.url,
          method: req.method,
          headers: req.headers,
          params: req.params
        });
        return `myelixir-${serialized}`;
      }
    });

    // Initialize axios instance with security configurations
    this.axiosInstance = axios.create({
      ...apiConfig,
      adapter: this.cache.adapter
    });

    // Configure retry mechanism with exponential backoff
    axiosRetry(this.axiosInstance, {
      retries: apiConfig.retryConfig.maxRetries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => apiConfig.retryConfig.shouldRetry(error)
    });

    // Request interceptor for authentication and request signing
    this.axiosInstance.interceptors.request.use(
      async (config: RequestConfig) => {
        const requestId = uuidv4();
        config.headers['X-Request-ID'] = requestId;

        if (config.requiresAuth) {
          const tokens = getStoredTokens(window.navigator.userAgent);
          if (!tokens || !isTokenValid(tokens.accessToken, window.navigator.userAgent)) {
            throw new Error(AuthError.UNAUTHORIZED);
          }
          config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        }

        // Add HIPAA-compliant headers
        config.headers['X-Correlation-ID'] = requestId;
        config.headers['X-Client-Timestamp'] = new Date().toISOString();

        // Audit log request
        this.logger.info('API Request', {
          requestId,
          method: config.method,
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        });

        return config;
      },
      (error) => {
        this.logger.error('Request Interceptor Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and audit logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['X-Request-ID'];
        
        // Audit log response
        this.logger.info('API Response', {
          requestId,
          status: response.status,
          headers: this.sanitizeHeaders(response.headers)
        });

        return response;
      },
      (error) => {
        const requestId = error.config?.headers['X-Request-ID'];
        
        // Audit log error
        this.logger.error('API Error', {
          requestId,
          status: error.response?.status,
          message: error.message,
          code: error.code
        });

        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Performs secure GET request with caching and audit logging
   */
  public async get<T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(url, {
        ...config,
        headers: {
          ...config.headers,
          'Cache-Control': config.skipCache ? 'no-cache' : 'max-age=900'
        }
      });

      return this.formatResponse(response);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Performs secure POST request with audit logging
   */
  public async post<T = any>(url: string, data: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(url, this.sanitizeData(data), config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Performs secure PUT request with audit logging
   */
  public async put<T = any>(url: string, data: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<T>(url, this.sanitizeData(data), config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Performs secure DELETE request with audit logging
   */
  public async delete<T = any>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Sanitizes request data to prevent sensitive information exposure
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'token', 'ssn', 'creditCard'];
    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitizes headers to prevent sensitive information exposure in logs
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-csrf-token'];
    const sanitized = { ...headers };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Formats API response to standardized structure
   */
  private formatResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
      cached: response.request.fromCache || false
    };
  }

  /**
   * Handles API errors with HIPAA-compliant error logging
   */
  private handleApiError(error: any): Error {
    const errorResponse = {
      message: error.message,
      status: error.response?.status,
      code: error.code,
      timestamp: new Date().toISOString()
    };

    // Log error details for HIPAA compliance
    this.logger.error('API Error Details', {
      ...errorResponse,
      stack: error.stack
    });

    // Return sanitized error for client
    return new Error(errorResponse.message);
  }
}

export default new ApiService();