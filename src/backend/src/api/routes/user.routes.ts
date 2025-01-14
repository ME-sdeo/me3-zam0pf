/**
 * @file User routes implementation for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description HIPAA-compliant user management routes with comprehensive security controls
 */

import { Router } from 'express'; // version: 4.18.x
import helmet from 'helmet'; // version: 7.0.x
import correlator from 'express-correlation-id'; // version: 2.0.x
import { UserController } from '../controllers/user.controller';
import {
  authenticate,
  authorize,
  verifyMFA,
  rateLimit,
  auditLog
} from '../middlewares/auth.middleware';
import {
  createUserSchema,
  updateUserSchema,
  updateUserPreferencesSchema
} from '../validators/user.validator';
import { validateRequest } from '../middlewares/validation.middleware';
import { UserRole } from '../../interfaces/user.interface';

// Constants for route configuration
const USER_BASE_ROUTE = '/api/v1/users';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

// Initialize router with security defaults
const userRouter = Router();

// Apply global middleware for all user routes
userRouter.use(correlator());
userRouter.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: true,
  xssFilter: true
}));

// Initialize UserController
const userController = new UserController();

// User creation route - Admin only
userRouter.post(
  '/',
  authenticate,
  authorize([UserRole.ADMIN]),
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  validateRequest(createUserSchema),
  auditLog('user.create'),
  userController.createUser
);

// Get user by ID - Authorized roles with MFA
userRouter.get(
  '/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.CONSUMER, UserRole.COMPANY]),
  verifyMFA,
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  auditLog('user.read'),
  userController.getUserById
);

// Update user - Authorized roles with MFA
userRouter.put(
  '/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.CONSUMER, UserRole.COMPANY]),
  verifyMFA,
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  validateRequest(updateUserSchema),
  auditLog('user.update'),
  userController.updateUser
);

// Delete user - Admin only with MFA
userRouter.delete(
  '/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  verifyMFA,
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  auditLog('user.delete'),
  userController.deleteUser
);

// Enable MFA - Self or Admin with existing MFA verification
userRouter.post(
  '/:id/mfa',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.CONSUMER, UserRole.COMPANY]),
  verifyMFA,
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  auditLog('user.mfa.enable'),
  userController.enableMFA
);

// Update user preferences - Self or Admin
userRouter.put(
  '/:id/preferences',
  authenticate,
  authorize([UserRole.CONSUMER, UserRole.COMPANY]),
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }),
  validateRequest(updateUserPreferencesSchema),
  auditLog('user.preferences.update'),
  userController.updateUserPreferences
);

// Health check endpoint - No auth required
userRouter.get(
  '/health',
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS * 2 // Higher limit for health checks
  }),
  (_, res) => res.status(200).json({ status: 'healthy' })
);

export default userRouter;