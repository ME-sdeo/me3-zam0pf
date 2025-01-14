import { RequestStatus, MatchStatus } from '../types/marketplace.types';

/**
 * Constants for marketplace request limits and validation parameters
 * Enforces strict compliance with healthcare data exchange regulations
 */
export const REQUEST_LIMITS = {
  MIN_PRICE_PER_RECORD: 0.1, // Minimum price per health record in USD
  MAX_RECORDS_PER_REQUEST: 10000, // Maximum records per data request
  MAX_ACTIVE_REQUESTS: 5, // Maximum concurrent active requests per company
  MAX_REQUEST_DURATION_DAYS: 30, // Maximum duration for a data request
  MAX_REQUEST_VALUE: 50000, // Maximum total value per request in USD
  RATE_LIMIT_WINDOW: 3600, // Rate limiting window in seconds (1 hour)
  MAX_REQUESTS_PER_WINDOW: 1000, // Maximum requests per rate limit window
  CONCURRENT_REQUEST_LIMIT: 50, // Maximum concurrent processing requests
  BATCH_SIZE: 100, // Optimal batch size for request processing
  REQUEST_TIMEOUT: 30000, // Request timeout in milliseconds
} as const;

/**
 * Constants for match scoring thresholds and compliance requirements
 * Implements HIPAA/GDPR compliant matching criteria
 */
export const MATCH_THRESHOLDS = {
  MIN_MATCH_SCORE: 0.7, // Minimum required match score
  MAX_MATCHES_PER_REQUEST: 1000, // Maximum matches per request
  COMPLIANCE_SCORE: 0.9, // Required compliance score
  PRIVACY_THRESHOLD: 0.95, // Privacy protection threshold
  SCORE_WEIGHTS: {
    DEMOGRAPHICS: 0.4, // Weight for demographic matching
    CONDITIONS: 0.4, // Weight for condition matching
    DATES: 0.2, // Weight for date range matching
  },
  COMPLIANCE_WEIGHTS: {
    HIPAA: 0.5, // HIPAA compliance weight
    GDPR: 0.3, // GDPR compliance weight
    SECURITY: 0.2, // Security controls weight
  },
  MATCH_EXPIRY: 86400, // Match result expiry in seconds (24 hours)
} as const;

/**
 * Cache configuration for distributed marketplace operations
 * Optimizes performance while maintaining data consistency
 */
export const CACHE_CONFIG = {
  MATCH_RESULTS_TTL: 3600, // Cache TTL for match results (1 hour)
  REQUEST_CACHE_TTL: 86400, // Cache TTL for request data (24 hours)
  CACHE_PREFIX: 'marketplace:', // Global cache prefix
  DISTRIBUTED_CACHE_CONFIG: {
    MAX_RETRIES: 3, // Maximum retry attempts
    RETRY_DELAY: 1000, // Retry delay in milliseconds
    CLUSTER_SIZE: 3, // Number of cache cluster nodes
    REPLICATION_FACTOR: 2, // Cache replication factor
    CONSISTENCY_LEVEL: 'strong', // Cache consistency level
  },
  CACHE_SEGMENTS: {
    MATCHES: 'matches:', // Match results segment
    REQUESTS: 'requests:', // Request data segment
    ANALYTICS: 'analytics:', // Analytics data segment
    AUDIT: 'audit:', // Audit trail segment
  },
  INVALIDATION_BATCH_SIZE: 1000, // Cache invalidation batch size
} as const;

/**
 * Status messages for marketplace request states
 * Provides standardized messaging for request lifecycle
 */
export const REQUEST_STATUS_MESSAGES: Record<RequestStatus, string> = {
  [RequestStatus.ACTIVE]: 'Request is actively seeking matches',
  [RequestStatus.COMPLETED]: 'Required number of matches found',
  [RequestStatus.EXPIRED]: 'Request duration exceeded',
  [RequestStatus.CANCELLED]: 'Request cancelled by company',
  [RequestStatus.DRAFT]: 'Request in draft state',
  [RequestStatus.MATCHING]: 'Currently processing matches',
  [RequestStatus.SUSPENDED]: 'Request temporarily suspended',
  [RequestStatus.UNDER_REVIEW]: 'Under compliance review',
} as const;

/**
 * Compliance level thresholds for data matching
 * Enforces regulatory compliance requirements
 */
export const COMPLIANCE_LEVELS = {
  STRICT: 0.95, // Strict compliance requirement
  STANDARD: 0.90, // Standard compliance requirement
  MINIMUM: 0.85, // Minimum acceptable compliance
  VALIDATION_THRESHOLD: 0.99, // Required validation success rate
  AUDIT_FREQUENCY: 24 * 60 * 60, // Audit frequency in seconds
} as const;

/**
 * Performance optimization constants
 * Tunes system performance while maintaining security
 */
export const PERFORMANCE_CONFIG = {
  MAX_CONCURRENT_MATCHES: 100, // Maximum concurrent match operations
  BATCH_PROCESSING_SIZE: 50, // Optimal batch size for processing
  QUEUE_TIMEOUT: 5000, // Queue timeout in milliseconds
  WORKER_POOL_SIZE: 4, // Number of worker threads
  RETRY_STRATEGIES: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MULTIPLIER: 1.5,
    INITIAL_DELAY: 1000,
  },
} as const;

/**
 * Analytics and monitoring thresholds
 * Defines KPIs and monitoring parameters
 */
export const ANALYTICS_CONFIG = {
  SAMPLING_RATE: 0.1, // Analytics sampling rate
  RETENTION_PERIOD: 90, // Data retention in days
  ALERT_THRESHOLDS: {
    ERROR_RATE: 0.01, // Maximum acceptable error rate
    LATENCY_MS: 2000, // Maximum acceptable latency
    MATCH_FAILURE_RATE: 0.05, // Maximum match failure rate
  },
  REPORTING_INTERVAL: 3600, // Reporting interval in seconds
} as const;