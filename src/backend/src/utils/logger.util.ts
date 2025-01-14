/**
 * @file Centralized logging utility for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Provides HIPAA-compliant logging with security monitoring and Azure Application Insights integration
 */

import winston from 'winston'; // ^3.8.0
import * as ApplicationInsights from 'applicationinsights'; // ^2.5.0
import { createHash, randomBytes } from 'crypto';
import { loggingConfig } from '../config/logging.config';
import { ErrorCode, ErrorCategory, getErrorCategory } from '../constants/error.constants';

// Enhanced log levels with security and audit focus
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  http: 4,
  security: 0, // High priority for security events
  audit: 0     // High priority for audit events
} as const;

// Color scheme for development environment
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  http: 'magenta',
  security: 'red',
  audit: 'cyan'
} as const;

// Security alert thresholds for monitoring
const SECURITY_ALERT_THRESHOLDS = {
  failedLogins: 5,      // Alert after 5 failed attempts
  unauthorizedAccess: 3, // Alert after 3 unauthorized attempts
  dataExfiltration: 1    // Alert immediately on potential data exfiltration
} as const;

/**
 * Creates a unique correlation ID for request tracking
 * @returns Unique correlation ID
 */
const generateCorrelationId = (): string => {
  return createHash('sha256')
    .update(randomBytes(32))
    .digest('hex')
    .substring(0, 32);
};

/**
 * Masks sensitive information in log messages
 * @param message - Log message to mask
 * @param patterns - Array of PII patterns to mask
 * @returns Masked message
 */
const maskSensitiveData = (message: string, patterns: RegExp[]): string => {
  let maskedMessage = message;
  patterns.forEach(pattern => {
    maskedMessage = maskedMessage.replace(pattern, '***REDACTED***');
  });
  return maskedMessage;
};

/**
 * Creates metadata for log entries including security context
 * @param metadata - Base metadata object
 * @param securityContext - Security-specific metadata
 * @returns Enhanced metadata object
 */
const createLogMetadata = (
  metadata: Record<string, any> = {},
  securityContext: Record<string, any> = {}
): Record<string, any> => {
  return {
    timestamp: new Date().toISOString(),
    correlationId: metadata.correlationId || generateCorrelationId(),
    environment: process.env.NODE_ENV,
    version: process.env.API_VERSION,
    userId: maskSensitiveData(metadata.userId || 'anonymous', loggingConfig.piiPatterns),
    ipAddress: maskSensitiveData(metadata.ipAddress || 'unknown', loggingConfig.piiPatterns),
    resourceType: metadata.resourceType || 'unknown',
    action: metadata.action || 'unknown',
    securityLevel: securityContext.level || 'normal',
    hipaaRelevant: securityContext.hipaaRelevant || false,
    auditRequired: securityContext.auditRequired || false,
    ...metadata
  };
};

/**
 * Initializes the Winston logger with security and compliance features
 * @returns Configured Winston logger instance
 */
const initializeLogger = (): winston.Logger => {
  // Initialize Application Insights
  if (loggingConfig.appInsightsKey) {
    ApplicationInsights.setup(loggingConfig.appInsightsKey)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .start();
  }

  // Create Winston logger instance
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    level: loggingConfig.logLevel,
    format: loggingConfig.format,
    transports: loggingConfig.transports,
    exitOnError: false
  });

  // Add security monitoring
  logger.on('data', (log) => {
    const level = log.level as keyof typeof LOG_LEVELS;
    
    // Monitor for security events
    if (level === 'security') {
      const securityEvent = log.message;
      if (securityEvent.includes('failed_login')) {
        const failedLogins = parseInt(securityEvent.split(':')[1], 10);
        if (failedLogins >= SECURITY_ALERT_THRESHOLDS.failedLogins) {
          logger.error('SECURITY_ALERT: Multiple failed login attempts detected', {
            alertType: 'failed_login_threshold',
            attempts: failedLogins
          });
        }
      }
    }

    // Monitor for unauthorized access
    if (level === 'error' && log.message.includes('unauthorized')) {
      logger.security('Unauthorized access attempt detected', {
        ...log.metadata,
        alertType: 'unauthorized_access'
      });
    }
  });

  return logger;
};

// Initialize the logger
const logger = initializeLogger();

// Export the logger instance and utility functions
export {
  logger,
  createLogMetadata,
  maskSensitiveData,
  LOG_LEVELS,
  SECURITY_ALERT_THRESHOLDS
};

export default logger;