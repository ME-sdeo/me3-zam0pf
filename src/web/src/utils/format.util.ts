import numeral from 'numeral'; // numeral ^2.0.6
import { createLogger, format, transports } from 'winston'; // winston ^3.8.0
import { FHIRResourceType } from '../types/fhir.types';
import { formatDate } from './date.util';
import { FHIR_RESOURCE_TYPES } from '../constants/fhir.constants';

// Constants for formatting configuration
const DEFAULT_TRUNCATE_LENGTH = 100;
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const CURRENCY_FORMAT = {
  USD: '$0,0.00',
  EUR: '€0,0.00',
  GBP: '£0,0.00'
} as const;

// HIPAA-compliant PHI masking patterns
const PHI_MASKING_PATTERNS = {
  SSN: 'XXX-XX-XXXX',
  EMAIL: '***@***.***',
  PHONE: '(XXX) XXX-XXXX',
  NAME: '*** ***',
  DOB: 'XXXX-XX-XX'
} as const;

// Configure logger for HIPAA compliance
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'formatting-audit.log' })
  ]
});

/**
 * Formats a number as currency with proper locale support
 * @param amount - Numeric amount to format
 * @param currencyCode - ISO currency code (USD, EUR, GBP)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currencyCode: keyof typeof CURRENCY_FORMAT = 'USD'
): string => {
  try {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Invalid amount provided');
    }

    const format = CURRENCY_FORMAT[currencyCode];
    return numeral(amount).format(format);
  } catch (error) {
    logger.error('Currency formatting error:', { amount, currencyCode, error });
    return 'Invalid Amount';
  }
};

/**
 * Formats file size with appropriate units
 * @param bytes - Size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  try {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${FILE_SIZE_UNITS[i]}`;
  } catch (error) {
    logger.error('File size formatting error:', { bytes, error });
    return 'Invalid Size';
  }
};

/**
 * Safely truncates text with RTL support and accessibility
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @param isRTL - Right-to-left text direction
 * @returns Truncated text with ellipsis
 */
export const truncateText = (
  text: string,
  maxLength: number = DEFAULT_TRUNCATE_LENGTH,
  isRTL: boolean = false
): string => {
  try {
    if (!text || maxLength <= 0) return '';
    
    if (text.length <= maxLength) return text;
    
    const truncated = text.slice(0, maxLength);
    const ellipsis = isRTL ? '... ' : ' ...';
    
    return truncated + ellipsis;
  } catch (error) {
    logger.error('Text truncation error:', { text, maxLength, isRTL, error });
    return text;
  }
};

/**
 * Formats FHIR resources with HIPAA compliance and data masking
 * @param resource - FHIR resource object
 * @param resourceType - Type of FHIR resource
 * @param maskingConfig - PHI masking configuration
 * @returns Formatted and masked resource string
 */
export const formatFHIRResource = (
  resource: any,
  resourceType: FHIRResourceType,
  maskingConfig: { maskPHI: boolean } = { maskPHI: true }
): string => {
  try {
    if (!resource || !resourceType) {
      throw new Error('Invalid FHIR resource or type');
    }

    // Validate resource type
    if (!Object.values(FHIR_RESOURCE_TYPES).includes(resourceType)) {
      throw new Error('Unsupported FHIR resource type');
    }

    // Deep clone to avoid modifying original
    const formattedResource = JSON.parse(JSON.stringify(resource));

    if (maskingConfig.maskPHI) {
      // Apply PHI masking based on resource type
      switch (resourceType) {
        case 'Patient':
          if (formattedResource.name) {
            formattedResource.name = PHI_MASKING_PATTERNS.NAME;
          }
          if (formattedResource.birthDate) {
            formattedResource.birthDate = PHI_MASKING_PATTERNS.DOB;
          }
          if (formattedResource.telecom) {
            formattedResource.telecom = formattedResource.telecom.map((t: any) => ({
              ...t,
              value: PHI_MASKING_PATTERNS.PHONE
            }));
          }
          break;
          
        case 'Observation':
        case 'Condition':
          if (formattedResource.subject?.reference) {
            formattedResource.subject.reference = `Patient/${formattedResource.subject.reference.split('/')[1]}`;
          }
          break;
      }
    }

    // Format dates
    const formatDates = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && key.toLowerCase().includes('date')) {
          obj[key] = formatDate(obj[key]);
        } else if (typeof obj[key] === 'object') {
          formatDates(obj[key]);
        }
      }
    };
    
    formatDates(formattedResource);

    logger.info('FHIR resource formatted:', { 
      resourceType,
      resourceId: formattedResource.id,
      masked: maskingConfig.maskPHI 
    });

    return JSON.stringify(formattedResource, null, 2);
  } catch (error) {
    logger.error('FHIR formatting error:', { resourceType, error });
    return 'Error formatting FHIR resource';
  }
};

/**
 * Formats a percentage value with proper rounding
 * @param value - Numeric value to format as percentage
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1
): string => {
  try {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Invalid value provided');
    }

    const percentage = value * 100;
    return `${percentage.toFixed(decimals)}%`;
  } catch (error) {
    logger.error('Percentage formatting error:', { value, decimals, error });
    return 'Invalid Percentage';
  }
};

/**
 * Formats a number with thousands separators and decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  decimals: number = 0
): string => {
  try {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Invalid number provided');
    }

    return numeral(value).format(`0,0[.]${Array(decimals).fill('0').join('')}`);
  } catch (error) {
    logger.error('Number formatting error:', { value, decimals, error });
    return 'Invalid Number';
  }
};