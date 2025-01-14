/**
 * @file Logging configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Centralized logging system with Azure Application Insights integration,
 * HIPAA compliance, and enhanced security monitoring capabilities
 */

import winston from 'winston'; // ^3.8.0
import * as ApplicationInsights from 'applicationinsights'; // ^2.5.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.1
import { appConfig } from './app.config';

// Custom log levels with security and audit focus
const LOG_LEVELS = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  security: 4,
  audit: 5,
  warn: 6,
  notice: 7,
  info: 8,
  http: 9,
  debug: 10,
} as const;

// Color scheme for console logging
const LOG_COLORS = {
  emergency: 'red',
  alert: 'red',
  critical: 'red',
  error: 'red',
  security: 'magenta',
  audit: 'cyan',
  warn: 'yellow',
  notice: 'blue',
  info: 'green',
  http: 'magenta',
  debug: 'gray',
} as const;

// PII detection patterns for masking sensitive data
const PII_PATTERNS = [
  '\\b\\d{3}-\\d{2}-\\d{4}\\b', // SSN
  '\\b\\d{9}\\b', // Patient ID
  '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', // Email
];

/**
 * Masks personally identifiable information in log messages
 * @param message - The log message to mask
 * @returns Masked log message with PII removed
 */
const maskPII = (message: string): string => {
  let maskedMessage = message;
  PII_PATTERNS.forEach(pattern => {
    const regex = new RegExp(pattern, 'g');
    maskedMessage = maskedMessage.replace(regex, '***REDACTED***');
  });
  return maskedMessage;
};

/**
 * Creates Winston log format configuration with security enhancements
 * @returns Winston format configuration
 */
const getLogFormat = () => {
  const { format } = winston;
  return format.combine(
    format.timestamp({ format: 'ISO' }),
    format.errors({ stack: true }),
    format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'stack']
    }),
    format((info) => {
      info.message = maskPII(info.message);
      return info;
    })(),
    format.json(),
    appConfig.env === 'development' ? format.colorize({ colors: LOG_COLORS }) : format.uncolorize(),
    format.printf(({ timestamp, level, message, metadata, stack }) => {
      const hipaaMetadata = {
        correlationId: metadata.correlationId || 'N/A',
        userId: metadata.userId || 'N/A',
        action: metadata.action || 'N/A',
        resourceType: metadata.resourceType || 'N/A',
      };

      return JSON.stringify({
        timestamp,
        level,
        message,
        ...hipaaMetadata,
        ...(stack && { stack }),
        ...metadata,
      });
    })
  );
};

/**
 * Configures secure logging transports with encryption and retention
 * @returns Array of configured Winston transports
 */
const getTransports = () => {
  const transports: winston.transport[] = [];

  // Console transport for development
  if (appConfig.env === 'development') {
    transports.push(new winston.transports.Console({
      level: appConfig.logging.level,
      handleExceptions: true,
    }));
  }

  // Secure file transport with encryption and retention
  const fileTransport = new DailyRotateFile({
    filename: 'logs/myelixir-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7y', // HIPAA requires 7 years retention
    format: winston.format.encrypt({
      secret: process.env.LOG_ENCRYPTION_KEY || 'default-key'
    }),
  });

  transports.push(fileTransport);

  // Azure Application Insights transport
  if (appConfig.logging.applicationInsights.enabled) {
    ApplicationInsights.setup(appConfig.logging.applicationInsights.instrumentationKey)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .setDistributedTracingMode(ApplicationInsights.DistributedTracingModes.AI_AND_W3C)
      .start();

    transports.push(new winston.transports.Http({
      host: 'dc.services.visualstudio.com',
      path: `/v2/track`,
      ssl: true,
      format: winston.format.json(),
    }));
  }

  // Audit-specific transport
  const auditTransport = new DailyRotateFile({
    filename: 'logs/audit/audit-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxFiles: '7y',
    level: 'audit',
  });

  transports.push(auditTransport);

  return transports;
};

/**
 * Exported logging configuration
 */
export const loggingConfig = {
  levels: LOG_LEVELS,
  level: appConfig.logging.level,
  format: getLogFormat(),
  transports: getTransports(),
  exitOnError: false,
  
  // Security alert thresholds
  securityAlertThresholds: {
    failedLogins: 5, // Alerts after 5 failed logins in 10 minutes
    dataAccess: 100, // Alerts after 100 record accesses in 1 minute
    apiErrors: 50, // Alerts after 50 errors in 5 minutes
  },

  // HIPAA compliance settings
  hipaaCompliance: {
    enabled: true,
    retentionYears: 7,
    encryptionEnabled: true,
    auditEvents: [
      'data.access',
      'consent.modify',
      'user.login',
      'user.logout',
      'record.create',
      'record.modify',
      'record.delete',
    ],
  },
} as const;

export default loggingConfig;