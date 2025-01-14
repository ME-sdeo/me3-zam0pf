/**
 * @file Marketplace routes configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description HIPAA-compliant routes for secure data request management with blockchain verification
 */

import { Router } from 'express'; // v4.18.x
import helmet from 'helmet'; // v6.x
import compression from 'compression'; // v1.7.x
import { MarketplaceController } from '../controllers/marketplace.controller';
import {
  authenticate,
  authorize,
  verifyMFA,
  rateLimit,
  auditLog
} from '../middlewares/auth.middleware';
import {
  validateDataRequest,
  validateMarketplaceTransaction,
  validateCompliance
} from '../validators/marketplace.validator';

/**
 * Initializes marketplace routes with comprehensive security and compliance middleware
 * @returns Configured Express router with security middleware
 */
const initializeMarketplaceRoutes = (): Router => {
  const router = Router();
  const marketplaceController = new MarketplaceController();

  // Apply security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Enable response compression
  router.use(compression());

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * Create new data request with HIPAA compliance validation
   * @route POST /requests
   */
  router.post(
    '/requests',
    authorize(['company']),
    rateLimit({ windowMs: 60000, max: 10 }),
    validateDataRequest,
    validateCompliance,
    auditLog('marketplace.request.create'),
    marketplaceController.createRequest
  );

  /**
   * Get company's data requests with compliance metadata
   * @route GET /requests/company/:companyId
   */
  router.get(
    '/requests/company/:companyId',
    authorize(['company', 'admin']),
    rateLimit({ windowMs: 60000, max: 100 }),
    auditLog('marketplace.request.list'),
    marketplaceController.getCompanyRequests
  );

  /**
   * Find matching records with HIPAA compliance verification
   * @route GET /requests/:requestId/matches
   */
  router.get(
    '/requests/:requestId/matches',
    authorize(['company']),
    rateLimit({ windowMs: 60000, max: 50 }),
    validateCompliance,
    auditLog('marketplace.request.matches'),
    marketplaceController.findMatches
  );

  /**
   * Process marketplace transaction with blockchain verification
   * @route POST /transactions
   */
  router.post(
    '/transactions',
    authorize(['company']),
    rateLimit({ windowMs: 60000, max: 10 }),
    validateMarketplaceTransaction,
    validateCompliance,
    verifyMFA,
    auditLog('marketplace.transaction.process'),
    marketplaceController.processTransaction
  );

  /**
   * Update request status with compliance verification
   * @route PUT /requests/:requestId/status
   */
  router.put(
    '/requests/:requestId/status',
    authorize(['company', 'admin']),
    rateLimit({ windowMs: 60000, max: 20 }),
    validateCompliance,
    auditLog('marketplace.request.status.update'),
    marketplaceController.updateRequestStatus
  );

  return router;
};

// Create and export configured router
const marketplaceRouter = initializeMarketplaceRoutes();
export default marketplaceRouter;