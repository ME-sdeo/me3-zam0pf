import { format, isValid, parseISO, subDays, formatDistanceToNow } from 'date-fns'; // date-fns ^2.30.0

// Global constants for date formatting and configuration
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const TIMEZONE = 'UTC';

// Error messages for date validation
const DATE_ERRORS = {
  INVALID_DATE: 'Invalid date provided',
  FUTURE_DATE: 'Future dates not allowed',
  RANGE_ERROR: 'Invalid date range'
} as const;

interface RelativeTimeOptions {
  addSuffix?: boolean;
  includeSeconds?: boolean;
}

interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  error?: string;
}

interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Securely formats a date into a standardized string representation
 * @param date - Date object or ISO date string to format
 * @param formatString - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @param useUTC - Whether to use UTC timezone
 * @returns Formatted date string or error message
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DEFAULT_DATE_FORMAT,
  useUTC: boolean = false
): string => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(parsedDate)) {
      return DATE_ERRORS.INVALID_DATE;
    }

    return format(parsedDate, formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return DATE_ERRORS.INVALID_DATE;
  }
};

/**
 * Safely parses a date string into a Date object with validation
 * @param dateString - ISO date string to parse
 * @returns Parsed Date object or null for invalid dates
 */
export const parseDate = (dateString: string): Date | null => {
  try {
    // Sanitize input string by trimming and validating format
    const sanitizedDate = dateString.trim();
    const parsedDate = parseISO(sanitizedDate);

    if (!isValid(parsedDate)) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

/**
 * Comprehensively validates date strings or objects for healthcare data integrity
 * @param date - Date to validate
 * @param allowFuture - Whether to allow future dates
 * @returns Validation result with optional error message
 */
export const isValidDate = (
  date: Date | string,
  allowFuture: boolean = false
): DateValidationResult => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(parsedDate)) {
      return { isValid: false, error: DATE_ERRORS.INVALID_DATE };
    }

    // Check for future dates if not allowed
    if (!allowFuture && parsedDate > new Date()) {
      return { isValid: false, error: DATE_ERRORS.FUTURE_DATE };
    }

    // Verify date is within reasonable range (e.g., not before 1900)
    const minDate = new Date(1900, 0, 1);
    if (parsedDate < minDate) {
      return { isValid: false, error: 'Date must be after 1900' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Date validation error:', error);
    return { isValid: false, error: DATE_ERRORS.INVALID_DATE };
  }
};

/**
 * Calculates a validated date range with timezone consideration
 * @param referenceDate - Reference date for range calculation
 * @param days - Number of days to include in range
 * @param useUTC - Whether to use UTC timezone
 * @returns Date range object with start and end dates
 */
export const getDateRange = (
  referenceDate: Date,
  days: number,
  useUTC: boolean = false
): DateRangeResult => {
  try {
    const validation = isValidDate(referenceDate);
    if (!validation.isValid) {
      return { startDate: new Date(), endDate: new Date(), error: validation.error };
    }

    if (days < 0 || days > 365) {
      return { 
        startDate: new Date(), 
        endDate: new Date(), 
        error: 'Days must be between 0 and 365' 
      };
    }

    const endDate = useUTC ? 
      new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())) :
      new Date(referenceDate);

    const startDate = subDays(endDate, days);

    return { startDate, endDate };
  } catch (error) {
    console.error('Date range calculation error:', error);
    return { 
      startDate: new Date(), 
      endDate: new Date(), 
      error: DATE_ERRORS.RANGE_ERROR 
    };
  }
};

/**
 * Formats a date relative to current time with localization support
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Localized relative time string
 */
export const formatRelativeTime = (
  date: Date | string,
  options: RelativeTimeOptions = {}
): string => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(parsedDate)) {
      return DATE_ERRORS.INVALID_DATE;
    }

    return formatDistanceToNow(parsedDate, {
      addSuffix: options.addSuffix ?? true,
      includeSeconds: options.includeSeconds ?? false
    });
  } catch (error) {
    console.error('Relative time formatting error:', error);
    return DATE_ERRORS.INVALID_DATE;
  }
};