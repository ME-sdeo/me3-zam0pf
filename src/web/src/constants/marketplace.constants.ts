import { RequestStatus } from '../types/marketplace.types';

/**
 * Human-readable labels for request statuses
 * WCAG 2.1 AA compliant text for accessibility
 */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'Draft',
  [RequestStatus.ACTIVE]: 'Active',
  [RequestStatus.MATCHING]: 'Finding Matches',
  [RequestStatus.COMPLETED]: 'Completed',
  [RequestStatus.EXPIRED]: 'Expired',
  [RequestStatus.CANCELLED]: 'Cancelled'
} as const;

/**
 * Material UI color mappings for request status badges
 * Colors chosen for WCAG 2.1 AA compliance with semantic meaning
 */
export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'default',     // Gray for drafts
  [RequestStatus.ACTIVE]: 'primary',    // Blue for active
  [RequestStatus.MATCHING]: 'info',     // Light blue for matching
  [RequestStatus.COMPLETED]: 'success', // Green for completed
  [RequestStatus.EXPIRED]: 'warning',   // Orange for expired
  [RequestStatus.CANCELLED]: 'error'    // Red for cancelled
} as const;

/**
 * Marketplace business rules and validation limits
 * Enforces platform constraints and prevents abuse
 */
export const MARKETPLACE_LIMITS = {
  /**
   * Minimum price per record in USD
   * Prevents undervaluation of health data
   */
  MIN_PRICE_PER_RECORD: 0.1,

  /**
   * Maximum records per request
   * Prevents system overload and ensures fair resource distribution
   */
  MAX_RECORDS_PER_REQUEST: 10000,

  /**
   * Maximum duration for active requests in days
   * Ensures marketplace freshness and prevents stale requests
   */
  MAX_REQUEST_DURATION_DAYS: 30,

  /**
   * Maximum number of concurrent active requests per company
   * Prevents monopolization of the marketplace
   */
  MAX_ACTIVE_REQUESTS: 5
} as const;

/**
 * Display configuration for match results
 * Controls UI presentation and formatting
 */
export const MATCH_DISPLAY_CONFIG = {
  /**
   * Number of results to display per page
   * Optimized for desktop and mobile viewing
   */
  RESULTS_PER_PAGE: 10,

  /**
   * Minimum match score to display (0.0 to 1.0)
   * Filters out low-quality matches
   */
  MIN_MATCH_SCORE_DISPLAY: 0.7,

  /**
   * Number of decimal places for match score display
   * Provides appropriate precision without information overload
   */
  SCORE_DISPLAY_DECIMALS: 2,

  /**
   * Number of decimal places for price display
   * Ensures consistent financial presentation
   */
  PRICE_DISPLAY_DECIMALS: 2
} as const;