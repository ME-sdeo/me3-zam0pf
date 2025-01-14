/**
 * @file Authentication routes configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant authentication endpoints with Azure AD B2C integration
 */

import { Router } from 'express'; // version: 4.18.x
import helmet from 'helmet'; // version: 6.x
import { RateLimiterMemory } from 'rate-limiter-flexible'; // version: 2.4.x
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorize, verifyMFA } from '../middlewares/auth.middleware';
import { UserRole } from '../../interfaces/user.interface';
import { appConfig } from '../../config/app.config';

// Constants for route configuration
const BASE_PATH = '/api/v1/auth';
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;
const TOKEN_EXPIRY = 3600; // 1 hour

/**
 * Configures and returns the authentication router with enhanced security
 * @param authController Initialized AuthController instance
 * @returns Configured Express router with secured auth endpoints
 */
export const configureAuthRoutes = (authController: AuthController): Router => {
  const router = Router();

  // Apply security middleware
  router.use(helmet(appConfig.server.helmet));

  // Configure rate limiters
  const loginLimiter = new RateLimiterMemory({
    points: MAX_LOGIN_ATTEMPTS,
    duration: RATE_LIMIT_WINDOW,
    blockDuration: RATE_LIMIT_WINDOW * 2
  });

  const mfaLimiter = new RateLimiterMemory({
    points: 3,
    duration: 300000, // 5 minutes
    blockDuration: 600000 // 10 minutes
  });

  // Login route with enhanced security
  router.post(
    `${BASE_PATH}/login`,
    async (req, res, next) => {
      try {
        await loginLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }
    },
    authController.login.bind(authController)
  );

  // Token refresh route with validation
  router.post(
    `${BASE_PATH}/refresh`,
    async (req, res, next) => {
      try {
        await loginLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many refresh attempts. Please try again later.' });
      }
    },
    authController.refreshToken.bind(authController)
  );

  // MFA setup route with role-based access
  router.post(
    `${BASE_PATH}/mfa/setup`,
    authenticate,
    authorize([UserRole.CONSUMER, UserRole.COMPANY]),
    async (req, res, next) => {
      try {
        await mfaLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many MFA setup attempts. Please try again later.' });
      }
    },
    authController.setupMFA.bind(authController)
  );

  // MFA verification route with rate limiting
  router.post(
    `${BASE_PATH}/mfa/verify`,
    authenticate,
    async (req, res, next) => {
      try {
        await mfaLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many MFA verification attempts. Please try again later.' });
      }
    },
    authController.verifyMFA.bind(authController)
  );

  // Logout route with session cleanup
  router.post(
    `${BASE_PATH}/logout`,
    authenticate,
    authController.logout.bind(authController)
  );

  // Password reset initiation route
  router.post(
    `${BASE_PATH}/password/reset`,
    async (req, res, next) => {
      try {
        await loginLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
      }
    },
    authController.initiatePasswordReset.bind(authController)
  );

  // Password reset completion route
  router.post(
    `${BASE_PATH}/password/reset/complete`,
    async (req, res, next) => {
      try {
        await loginLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many password reset completion attempts. Please try again later.' });
      }
    },
    authController.completePasswordReset.bind(authController)
  );

  // Emergency access request route
  router.post(
    `${BASE_PATH}/emergency-access`,
    authenticate,
    authorize([UserRole.ADMIN]),
    authController.requestEmergencyAccess.bind(authController)
  );

  // Session validation route
  router.get(
    `${BASE_PATH}/session`,
    authenticate,
    authController.validateSession.bind(authController)
  );

  return router;
};

export default configureAuthRoutes;