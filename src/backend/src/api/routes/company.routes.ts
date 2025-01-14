/**
 * @file Company routes configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant routes with enhanced security controls for company management
 */

import express, { Router } from 'express'; // version: ^4.18.0
import rateLimit from 'express-rate-limit'; // version: ^6.7.0
import winston from 'winston'; // version: ^3.8.0
import { CompanyController } from '../controllers/company.controller';
import { 
  authenticate, 
  authorize, 
  verifyMFA 
} from '../middlewares/auth.middleware';
import validateRequest from '../middlewares/validation.middleware';
import { sanitizeData } from '../utils/validation.util';
import { UserRole } from '../interfaces/auth.interface';
import { appConfig } from '../../config/app.config';

// Initialize logger
const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: winston.format.json(),
  defaultMeta: { service: 'company-routes' },
  transports: [
    new winston.transports.File({ filename: 'company-routes.log' })
  ]
});

/**
 * Configures and returns the company routes with enhanced security controls
 * @param companyController Initialized company controller instance
 * @returns Configured Express router
 */
export function initializeCompanyRoutes(companyController: CompanyController): Router {
  const router = express.Router();

  // Company registration route
  router.post('/register',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
      message: 'Too many registration attempts, please try again later'
    }),
    validateRequest,
    sanitizeData,
    authenticate,
    authorize([UserRole.ADMIN]),
    async (req, res, next) => {
      try {
        logger.info('Company registration request received', {
          timestamp: new Date().toISOString(),
          ip: req.ip
        });
        await companyController.registerCompany(req, res);
      } catch (error) {
        logger.error('Company registration failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
        next(error);
      }
    }
  );

  // Company profile update route
  router.put('/:id',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: 'Too many update attempts, please try again later'
    }),
    validateRequest,
    sanitizeData,
    authenticate,
    authorize([UserRole.COMPANY, UserRole.ADMIN]),
    verifyMFA,
    async (req, res, next) => {
      try {
        logger.info('Company profile update request received', {
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        await companyController.updateCompanyProfile(req, res);
      } catch (error) {
        logger.error('Company profile update failed', {
          error: error.message,
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        next(error);
      }
    }
  );

  // Company profile retrieval route
  router.get('/:id',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Rate limit exceeded for profile retrieval'
    }),
    authenticate,
    authorize([UserRole.COMPANY, UserRole.ADMIN]),
    async (req, res, next) => {
      try {
        logger.info('Company profile retrieval request received', {
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        await companyController.getCompanyProfile(req, res);
      } catch (error) {
        logger.error('Company profile retrieval failed', {
          error: error.message,
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        next(error);
      }
    }
  );

  // Company verification route
  router.put('/:id/verify',
    rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10,
      message: 'Too many verification attempts, please try again later'
    }),
    validateRequest,
    sanitizeData,
    authenticate,
    authorize([UserRole.ADMIN]),
    verifyMFA,
    async (req, res, next) => {
      try {
        logger.info('Company verification request received', {
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        await companyController.verifyCompany(req, res);
      } catch (error) {
        logger.error('Company verification failed', {
          error: error.message,
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        next(error);
      }
    }
  );

  // Company status update route
  router.put('/:id/status',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many status update attempts, please try again later'
    }),
    validateRequest,
    sanitizeData,
    authenticate,
    authorize([UserRole.ADMIN]),
    verifyMFA,
    async (req, res, next) => {
      try {
        logger.info('Company status update request received', {
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        await companyController.updateCompanyStatus(req, res);
      } catch (error) {
        logger.error('Company status update failed', {
          error: error.message,
          companyId: req.params.id,
          timestamp: new Date().toISOString()
        });
        next(error);
      }
    }
  );

  return router;
}

// Export configured router
export default initializeCompanyRoutes;