import { MedplumClient } from '@medplum/core';
import {
  FHIR_VERSION,
  FHIR_RESOURCE_TYPES,
  FHIR_VALIDATION_RULES
} from '../constants/fhir.constants';

/**
 * Generates a unique request ID for FHIR API calls
 * @returns Unique request ID string
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Custom validators for specific FHIR resource types
 */
const CUSTOM_VALIDATORS = {
  [FHIR_RESOURCE_TYPES.PATIENT]: (resource: any) => {
    const errors: string[] = [];
    if (!resource.identifier?.length) {
      errors.push('Patient must have at least one identifier');
    }
    if (!resource.name?.length) {
      errors.push('Patient must have at least one name');
    }
    return errors;
  },
  [FHIR_RESOURCE_TYPES.OBSERVATION]: (resource: any) => {
    const errors: string[] = [];
    if (!resource.status) {
      errors.push('Observation must have a status');
    }
    if (!resource.code) {
      errors.push('Observation must have a code');
    }
    return errors;
  }
};

/**
 * Comprehensive FHIR configuration for frontend integration
 * Implements strict validation and enhanced error handling
 */
export const loadFHIRConfig = () => {
  const config = {
    client: {
      baseUrl: process.env.VITE_MEDPLUM_SERVER_URL,
      clientId: process.env.VITE_MEDPLUM_CLIENT_ID,
      version: FHIR_VERSION,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      headers: {
        'X-Request-ID': generateRequestId(),
        'X-Client-Version': process.env.VITE_APP_VERSION || ''
      }
    },

    validation: {
      enabled: true,
      rules: FHIR_VALIDATION_RULES,
      strictMode: true,
      validateOnUpload: true,
      errorAggregation: true,
      customValidators: CUSTOM_VALIDATORS,
      validationCache: {
        enabled: true,
        ttl: 3600 // 1 hour
      }
    },

    resourceTypes: FHIR_RESOURCE_TYPES,

    mimeTypes: {
      json: 'application/fhir+json',
      xml: 'application/fhir+xml'
    },

    errorHandling: {
      retryableErrors: ['TIMEOUT', 'NETWORK_ERROR'],
      maxRetries: 3,
      errorLogging: true,
      errorReporting: {
        enabled: true,
        sanitizeErrors: true,
        includeStackTrace: false
      }
    },

    audit: {
      enabled: true,
      logLevel: 'INFO',
      includeHeaders: false,
      maskSensitiveData: true,
      retentionDays: 90
    }
  };

  // Validate config
  if (!config.client?.baseUrl || !config.client?.clientId) {
    throw new Error('Invalid FHIR configuration: Missing required client settings');
  }

  // Audit config load
  if (config.audit?.enabled) {
    console.info('FHIR configuration loaded successfully', {
      version: config.client.version,
      baseUrl: config.client.baseUrl,
      validationEnabled: config.validation.enabled,
      timestamp: new Date().toISOString()
    });
  }

  return config;
};

/**
 * Initialize Medplum client with enhanced configuration
 * @returns Configured MedplumClient instance
 */
export const initializeMedplumClient = (): MedplumClient => {
  const config = loadFHIRConfig();
  return new MedplumClient({
    baseUrl: config.client.baseUrl,
    clientId: config.client.clientId,
    fetch: (url: string, options: RequestInit) => {
      const headers = new Headers(options.headers);
      Object.entries(config.client.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
      return fetch(url, { ...options, headers });
    }
  });
};

/**
 * Type-safe FHIR configuration object
 */
export const fhirConfig = loadFHIRConfig();

/**
 * Export type definitions for configuration
 */
export type FHIRConfig = typeof fhirConfig;
export type FHIRValidationRules = typeof FHIR_VALIDATION_RULES;
export type FHIRCustomValidators = typeof CUSTOM_VALIDATORS;