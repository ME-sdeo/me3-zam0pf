/**
 * @file Error handling middleware for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Provides centralized error handling with HIPAA compliance, security monitoring,
 * and Azure Application Insights integration
 */

import { Request, Response, NextFunction } from 'express';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { handleError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { ERROR_MESSAGES } from '../../constants/error.constants';

// Initialize Application Insights
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.AZURE_APP_INSIGHTS_KEY || '',
    enableAutoRouteTracking: true,
    enableRequestTracing: true,
    enableCorsCorrelation: true
  }
});

appInsights.loadAppInsights();

// Security headers for error responses
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Error sampling rate for production environment
const ERROR_SAMPLING_RATE = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;

/**
 * Centralized error handling middleware with HIPAA compliance and security monitoring
 * @param error - Error object thrown in the application
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = req.headers['x-correlation-id'] as string || 
    req.headers['x-request-id'] as string || 
    Math.random().toString(36).substring(7);

  // Create security context for error logging
  const securityContext = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestPath: req.path,
    requestMethod: req.method,
    timestamp: new Date().toISOString(),
    correlationId
  };

  // Mask PII data in error details
  const sanitizedError = {
    ...error,
    message: error.message.replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '***EMAIL***')
      .replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '***SSN***')
  };

  // Log error with security context
  logger.error('API Error occurred', {
    error: sanitizedError,
    context: securityContext,
    stack: error.stack,
    hipaaRelevant: true
  });

  // Create HIPAA-compliant audit log
  logger.auditLog('error_occurred', {
    eventType: 'security.error',
    severity: 'high',
    outcome: 'failure',
    ...securityContext
  });

  // Track error in Application Insights with sampling
  if (Math.random() < ERROR_SAMPLING_RATE) {
    appInsights.trackException({
      exception: sanitizedError,
      properties: {
        ...securityContext,
        environment: process.env.NODE_ENV,
        component: 'API',
        errorType: error.name
      }
    });
  }

  // Get formatted error response
  const errorResponse = handleError(error, req, res);

  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  // Set appropriate status code
  const statusCode = errorResponse.error.status || 500;

  // Update error rate metrics
  appInsights.trackMetric({
    name: 'error_rate',
    value: 1,
    properties: {
      statusCode: statusCode.toString(),
      errorType: error.name
    }
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorMiddleware;