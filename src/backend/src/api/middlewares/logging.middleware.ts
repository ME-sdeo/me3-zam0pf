/**
 * @file Logging middleware for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Express middleware providing comprehensive request/response logging with 
 * Azure Application Insights integration, security monitoring, and HIPAA-compliant audit trail
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.0
import morgan from 'morgan'; // ^1.10.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import * as appInsights from 'applicationinsights'; // ^2.5.0
import { logger, createLogMetadata, maskSensitiveData } from '../../utils/logger.util';
import { appConfig } from '../../config/app.config';

// PII patterns for sensitive data masking
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
  /\b\d{16}\b/g, // Credit card
  /\b\d{9}\b/g // Patient ID
];

// Morgan format for HTTP request logging
const morganFormat = ':method :url :status :res[content-length] - :response-time ms';

// Security alert thresholds
const SECURITY_ALERT_THRESHOLD = 100; // Requests per minute per IP

/**
 * Creates enhanced metadata for request logging with security context
 * @param req Express request object
 * @returns Enhanced request metadata
 */
const createRequestMetadata = (req: Request): Record<string, any> => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const requestId = req.headers['x-request-id'] || uuidv4();

  return createLogMetadata({
    correlationId,
    requestId,
    userId,
    ipAddress: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    resourceType: req.path.split('/')[2] || 'unknown',
    action: `${req.method.toLowerCase()}.${req.path.split('/')[3] || 'unknown'}`,
    securityContext: {
      hipaaRelevant: true,
      auditRequired: true,
      securityLevel: req.headers['x-security-level'] || 'normal'
    }
  });
};

/**
 * Masks sensitive data in request/response content
 * @param content Content to mask
 * @returns Masked content
 */
const maskRequestContent = (content: any): any => {
  if (!content) return content;

  if (typeof content === 'string') {
    return maskSensitiveData(content, PII_PATTERNS);
  }

  if (typeof content === 'object') {
    const masked = { ...content };
    for (const key in masked) {
      if (appConfig.logging.httpLogger.maskFields.includes(key)) {
        masked[key] = '***REDACTED***';
      } else if (typeof masked[key] === 'string') {
        masked[key] = maskSensitiveData(masked[key], PII_PATTERNS);
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskRequestContent(masked[key]);
      }
    }
    return masked;
  }

  return content;
};

/**
 * Express middleware for comprehensive request logging with security monitoring
 * and HIPAA-compliant audit trail capabilities
 */
export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Skip logging for excluded paths
  if (appConfig.logging.httpLogger.excludePaths.includes(req.path)) {
    return next();
  }

  // Generate and attach correlation IDs
  const requestId = uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.headers['x-request-id'] = requestId;
  req.headers['x-correlation-id'] = correlationId;

  // Create enhanced request metadata
  const metadata = createRequestMetadata(req);

  // Log incoming request
  logger.http('Incoming request', {
    ...metadata,
    headers: maskRequestContent(req.headers),
    query: maskRequestContent(req.query),
    body: maskRequestContent(req.body)
  });

  // Track request in Application Insights
  if (appConfig.logging.applicationInsights.enabled) {
    const client = appInsights.defaultClient;
    client.trackRequest({
      name: `${req.method} ${req.path}`,
      url: req.url,
      source: req.ip,
      duration: 0,
      resultCode: 0,
      success: true,
      properties: {
        correlationId,
        requestId,
        userId: metadata.userId
      }
    });
  }

  // Add response logging
  morgan(morganFormat, {
    stream: {
      write: (message: string) => {
        logger.http('Request completed', {
          ...metadata,
          response: maskRequestContent(message.trim())
        });
      }
    }
  })(req, res, () => {});

  // Create audit log entry
  logger.audit('API request', {
    ...metadata,
    requestBody: maskRequestContent(req.body),
    responseStatus: res.statusCode
  });

  // Monitor for security thresholds
  const requestCount = parseInt(req.headers['x-request-count'] as string || '0', 10);
  if (requestCount > SECURITY_ALERT_THRESHOLD) {
    logger.security('Request threshold exceeded', {
      ...metadata,
      threshold: SECURITY_ALERT_THRESHOLD,
      count: requestCount
    });
  }

  next();
};

export default requestLogger;