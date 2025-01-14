/**
 * @file Core application configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Manages environment settings, server configuration, logging, and global parameters
 * with enhanced security and HIPAA/GDPR compliance features
 */

import { config } from 'dotenv'; // v16.0.0
import { ERROR_MESSAGES } from '../constants/error.constants';

// Load environment variables
config();

/**
 * Validates all required configuration settings and environment variables
 * Ensures security and compliance requirements are met before application startup
 */
const validateConfig = (): void => {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'HOST',
    'API_VERSION',
    'LOG_LEVEL',
    'AZURE_APP_INSIGHTS_KEY'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate SSL configuration in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SSL_KEY_PATH || !process.env.SSL_CERT_PATH) {
      throw new Error('SSL certificate and key paths are required in production');
    }
  }

  // Validate port number
  const port = parseInt(process.env.PORT || '', 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    throw new Error('Port must be a number between 1024 and 65535');
  }

  // Validate API version format (semver)
  const semverRegex = /^v\d+\.\d+\.\d+$/;
  if (!semverRegex.test(process.env.API_VERSION || '')) {
    throw new Error('API version must follow semantic versioning format (e.g., v1.0.0)');
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(process.env.LOG_LEVEL?.toLowerCase() || '')) {
    throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }

  // Validate Azure Application Insights key format
  const insightsKeyRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!insightsKeyRegex.test(process.env.AZURE_APP_INSIGHTS_KEY || '')) {
    throw new Error('Invalid Azure Application Insights instrumentation key format');
  }
};

// Validate configuration on load
validateConfig();

/**
 * Core application configuration object
 * Contains all settings required for the MyElixir platform
 */
export const appConfig = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    ssl: {
      enabled: process.env.NODE_ENV === 'production',
      keyPath: process.env.SSL_KEY_PATH,
      certPath: process.env.SSL_CERT_PATH
    },
    corsOptions: {
      origin: [
        'https://*.myelixir.com',
        'https://*.medplum.com',
        process.env.NODE_ENV === 'development' ? 'http://localhost:*' : ''
      ].filter(Boolean),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
      credentials: true,
      maxAge: 86400,
      preflightContinue: false
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req: any) => req.ip
    },
    compression: {
      enabled: true,
      level: 6,
      threshold: '1kb',
      filter: (req: any) => !req.headers['x-no-compression']
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'https://*.myelixir.com', 'https://*.medplum.com'],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: true,
      xssFilter: true
    }
  },

  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: '/api',
    timeout: 30000, // 30 seconds
    pagination: {
      defaultLimit: 10,
      maxLimit: 100,
      maxOffset: 10000
    },
    fhir: {
      version: '4.0.1',
      validationEnabled: true,
      maxResourceSize: '5mb',
      supportedResources: ['Patient', 'Observation', 'Condition', 'Procedure']
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    httpLogger: {
      enabled: true,
      excludePaths: ['/health', '/metrics'],
      obfuscateHeaders: ['Authorization', 'Cookie', 'X-API-Key'],
      maskFields: ['password', 'ssn', 'creditCard']
    },
    applicationInsights: {
      enabled: true,
      instrumentationKey: process.env.AZURE_APP_INSIGHTS_KEY,
      samplingRate: 100,
      cloudRole: 'backend-api',
      disableStandardMetrics: false
    }
  },

  monitoring: {
    metrics: {
      enabled: true,
      path: '/metrics',
      defaultLabels: {
        service: 'myelixir-backend',
        version: process.env.API_VERSION
      },
      collectDefaultMetrics: true,
      prefix: 'myelixir_'
    },
    health: {
      enabled: true,
      path: '/health',
      timeout: 5000,
      checks: {
        database: true,
        redis: true,
        medplum: true,
        blockchain: true
      }
    },
    tracing: {
      enabled: true,
      samplingRate: 0.1,
      exporterType: 'jaeger'
    }
  },

  security: {
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 30
    },
    jwt: {
      algorithm: 'RS256',
      expiresIn: '1h',
      refreshExpiresIn: '7d'
    },
    audit: {
      enabled: true,
      storageRetentionDays: 2555, // 7 years for HIPAA compliance
      sensitiveOperations: ['consent.create', 'consent.update', 'data.access']
    }
  }
} as const;

export default appConfig;