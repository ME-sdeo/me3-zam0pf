/**
 * @fileoverview Express router configuration for HIPAA-compliant consent management endpoints
 * Implements secure routes with enhanced validation, audit logging, and blockchain integration
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { injectable } from 'inversify'; // v6.0.1
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import helmet from 'helmet'; // v7.0.0
import winston from 'winston'; // v3.8.2
import { ConsentController } from '../controllers/consent.controller';
import { authenticate, authorize, verifyMFA } from '../middlewares/auth.middleware';
import { validateConsent, validateConsentUpdate } from '../validators/consent.validator';
import { UserRole } from '../../interfaces/auth.interface';
import { appConfig } from '../../config/app.config';
import { ErrorCode } from '../../constants/error.constants';

// Base path for consent endpoints
const BASE_PATH = '/api/v1/consents';

// Configure rate limiting for consent endpoints
const consentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many consent requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

@injectable()
export class ConsentRoutes {
  private readonly logger: winston.Logger;

  constructor(
    private readonly consentController: ConsentController,
    logger: winston.Logger
  ) {
    this.logger = logger.child({ module: 'ConsentRoutes' });
  }

  /**
   * Configures all consent-related routes with enhanced security and validation
   * @param router - Express router instance
   * @returns Configured router with consent endpoints
   */
  public configureRoutes(router: Router): Router {
    // Apply security headers
    router.use(helmet());

    // Apply rate limiting
    router.use(BASE_PATH, consentRateLimiter);

    // Create new consent with MFA verification
    router.post(
      `${BASE_PATH}`,
      authenticate,
      authorize([UserRole.CONSUMER, UserRole.COMPANY]),
      verifyMFA,
      validateConsent,
      async (req, res, next) => {
        try {
          const result = await this.consentController.createConsent(req, res);
          this.logger.info('Consent created successfully', {
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          return result;
        } catch (error) {
          this.logger.error('Failed to create consent', {
            error: error.message,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          next(error);
        }
      }
    );

    // Update consent status with MFA verification
    router.put(
      `${BASE_PATH}/:id/status`,
      authenticate,
      authorize([UserRole.CONSUMER]),
      verifyMFA,
      validateConsentUpdate,
      async (req, res, next) => {
        try {
          const result = await this.consentController.updateConsentStatus(req, res);
          this.logger.info('Consent status updated successfully', {
            consentId: req.params.id,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          return result;
        } catch (error) {
          this.logger.error('Failed to update consent status', {
            error: error.message,
            consentId: req.params.id,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          next(error);
        }
      }
    );

    // Revoke consent with MFA verification
    router.delete(
      `${BASE_PATH}/:id`,
      authenticate,
      authorize([UserRole.CONSUMER]),
      verifyMFA,
      async (req, res, next) => {
        try {
          const result = await this.consentController.revokeConsent(req, res);
          this.logger.info('Consent revoked successfully', {
            consentId: req.params.id,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          return result;
        } catch (error) {
          this.logger.error('Failed to revoke consent', {
            error: error.message,
            consentId: req.params.id,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });
          next(error);
        }
      }
    );

    // Get user consents with pagination
    router.get(
      `${BASE_PATH}/user/:userId`,
      authenticate,
      authorize([UserRole.CONSUMER, UserRole.COMPANY]),
      async (req, res, next) => {
        try {
          const result = await this.consentController.getUserConsents(req, res);
          this.logger.info('User consents retrieved successfully', {
            userId: req.params.userId,
            timestamp: new Date().toISOString()
          });
          return result;
        } catch (error) {
          this.logger.error('Failed to retrieve user consents', {
            error: error.message,
            userId: req.params.userId,
            timestamp: new Date().toISOString()
          });
          next(error);
        }
      }
    );

    // Error handling middleware
    router.use(`${BASE_PATH}`, (error: any, req: any, res: any, next: any) => {
      this.logger.error('Consent route error', {
        error: error.message,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      const statusCode = error.statusCode || 500;
      const errorMessage = error.message || ErrorCode.CONS_001;

      res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    });

    return router;
  }
}

// Export configured router
export const configureConsentRoutes = (router: Router): Router => {
  const consentRoutes = new ConsentRoutes(
    new ConsentController(),
    winston.createLogger({
      level: appConfig.logging.level,
      format: winston.format.json(),
      defaultMeta: { service: 'consent-routes' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'consent-routes.log' })
      ]
    })
  );
  return consentRoutes.configureRoutes(router);
};

export default configureConsentRoutes;