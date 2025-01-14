/**
 * @fileoverview FHIR configuration settings for MyElixir platform
 * Provides comprehensive configuration for Medplum FHIR server integration including
 * connection settings, validation rules, caching policies, and security settings.
 * @version 1.0.0
 */

import { FHIR_VERSION, FHIR_VALIDATION_RULES } from '../constants/fhir.constants';
import { MedplumClient } from '@medplum/core'; // @medplum/core ^2.0.0

/**
 * Interface for FHIR server SSL configuration
 */
interface FHIRSSLConfig {
  enabled: boolean;
  minVersion: string;
  ciphers: string[];
}

/**
 * Interface for FHIR server configuration
 */
interface FHIRServerConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  version: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  ssl: FHIRSSLConfig;
}

/**
 * Interface for FHIR client connection pool settings
 */
interface FHIRClientConfig {
  maxConnections: number;
  keepAlive: boolean;
  requestTimeout: number;
  poolTimeout: number;
  idleTimeout: number;
  keepAliveTimeout: number;
}

/**
 * Interface for FHIR validation configuration
 */
interface FHIRValidationConfig {
  enabled: boolean;
  rules: typeof FHIR_VALIDATION_RULES;
  strictMode: boolean;
  validateOnWrite: boolean;
  validateOnRead: boolean;
  errorThreshold: number;
  customValidators: Array<(resource: any) => boolean>;
}

/**
 * Interface for FHIR cache configuration
 */
interface FHIRCacheConfig {
  enabled: boolean;
  ttl: number;
  prefix: string;
  maxSize: number;
  invalidateOnWrite: boolean;
  compression: boolean;
  monitoring: {
    enabled: boolean;
    sampleRate: number;
  };
}

/**
 * Interface for FHIR security configuration
 */
interface FHIRSecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotation: boolean;
    keyRotationInterval: number;
  };
  audit: {
    enabled: boolean;
    detailedLogging: boolean;
    retentionDays: number;
  };
}

/**
 * Comprehensive FHIR configuration object
 */
export const fhirConfig = {
  server: {
    baseUrl: process.env.MEDPLUM_SERVER_URL,
    clientId: process.env.MEDPLUM_CLIENT_ID,
    clientSecret: process.env.MEDPLUM_CLIENT_SECRET,
    version: FHIR_VERSION,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    ssl: {
      enabled: true,
      minVersion: 'TLSv1.2',
      ciphers: [
        'TLS_AES_256_GCM_SHA384'
      ]
    }
  } as FHIRServerConfig,

  client: {
    maxConnections: 100,
    keepAlive: true,
    requestTimeout: 15000, // 15 seconds
    poolTimeout: 30000, // 30 seconds
    idleTimeout: 10000, // 10 seconds
    keepAliveTimeout: 5000 // 5 seconds
  } as FHIRClientConfig,

  validation: {
    enabled: true,
    rules: FHIR_VALIDATION_RULES,
    strictMode: true,
    validateOnWrite: true,
    validateOnRead: false,
    errorThreshold: 0.001, // 0.1% error threshold for monitoring
    customValidators: []
  } as FHIRValidationConfig,

  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    prefix: 'fhir:',
    maxSize: 1000, // Maximum cache entries
    invalidateOnWrite: true,
    compression: true,
    monitoring: {
      enabled: true,
      sampleRate: 0.1 // 10% sampling rate
    }
  } as FHIRCacheConfig,

  security: {
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyRotation: true,
      keyRotationInterval: 86400 // 24 hours
    },
    audit: {
      enabled: true,
      detailedLogging: true,
      retentionDays: 90 // 90 days retention for audit logs
    }
  } as FHIRSecurityConfig
};

/**
 * Initializes and validates FHIR configuration
 * @returns Validated FHIR configuration object
 * @throws Error if configuration validation fails
 */
export function loadFHIRConfig(): typeof fhirConfig {
  validateEnvironmentVariables();
  validateSSLConfiguration();
  initializeConnectionPool();
  return fhirConfig;
}

/**
 * Validates required environment variables
 * @throws Error if required environment variables are missing
 */
function validateEnvironmentVariables(): void {
  const requiredEnvVars = [
    'MEDPLUM_SERVER_URL',
    'MEDPLUM_CLIENT_ID',
    'MEDPLUM_CLIENT_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

/**
 * Validates SSL configuration
 * @throws Error if SSL configuration is invalid
 */
function validateSSLConfiguration(): void {
  if (fhirConfig.server.ssl.enabled && 
      (!fhirConfig.server.ssl.minVersion || !fhirConfig.server.ssl.ciphers.length)) {
    throw new Error('Invalid SSL configuration');
  }
}

/**
 * Initializes connection pool settings
 */
function initializeConnectionPool(): void {
  if (fhirConfig.client.maxConnections < 1) {
    fhirConfig.client.maxConnections = 100;
  }
}

// Export initialized Medplum client instance
export const medplumClient = new MedplumClient({
  baseUrl: fhirConfig.server.baseUrl,
  clientId: fhirConfig.server.clientId,
  clientSecret: fhirConfig.server.clientSecret
});