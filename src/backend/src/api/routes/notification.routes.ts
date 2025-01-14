/**
 * @file Notification routes configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description HIPAA-compliant notification delivery with comprehensive security controls
 */

import express, { Router } from 'express'; // v4.18.2
import helmet from 'helmet'; // v4.6.0
import winston from 'winston'; // v3.8.2
import { NotificationController } from '../controllers/notification.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { userApiLimiter } from '../middlewares/rateLimiter.middleware';
import { validateNotificationRequest } from '../middlewares/validation.middleware';
import { UserRole } from '../../interfaces/user.interface';
import { logger } from '../../utils/logger.util';

// Constants for notification routes
const BASE_PATH = '/api/v1/notifications';
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY = 300000; // 5 minutes

/**
 * Initializes notification routes with HIPAA-compliant security controls
 * @param controller NotificationController instance
 * @returns Configured Express router
 */
export function initializeNotificationRoutes(controller: NotificationController): Router {
    const router = express.Router();

    // Apply security middleware
    router.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'"],
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

    // Consumer request notification endpoint
    router.post(
        '/consumer-request',
        authenticate,
        authorize([UserRole.COMPANY, UserRole.ADMIN]),
        userApiLimiter,
        validateNotificationRequest,
        async (req, res) => {
            try {
                await controller.sendConsumerRequestNotification(req, res);
                logger.info('Consumer request notification sent', {
                    userId: req.body.userId,
                    requestId: req.body.requestData?.requestId,
                    type: 'consumer-request'
                });
            } catch (error) {
                logger.error('Failed to send consumer request notification', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userId: req.body.userId
                });
                res.status(500).json({ error: 'Failed to send notification' });
            }
        }
    );

    // Data shared notification endpoint
    router.post(
        '/data-shared',
        authenticate,
        authorize([UserRole.COMPANY, UserRole.ADMIN]),
        userApiLimiter,
        validateNotificationRequest,
        async (req, res) => {
            try {
                await controller.sendDataSharedNotification(req, res);
                logger.info('Data shared notification sent', {
                    userId: req.body.userId,
                    requestId: req.body.sharingDetails?.requestId,
                    type: 'data-shared'
                });
            } catch (error) {
                logger.error('Failed to send data shared notification', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userId: req.body.userId
                });
                res.status(500).json({ error: 'Failed to send notification' });
            }
        }
    );

    // Company request notification endpoint
    router.post(
        '/company-request',
        authenticate,
        authorize([UserRole.ADMIN]),
        userApiLimiter,
        validateNotificationRequest,
        async (req, res) => {
            try {
                await controller.sendCompanyRequestNotification(req, res);
                logger.info('Company request notification sent', {
                    userId: req.body.userId,
                    requestId: req.body.requestDetails?.requestId,
                    type: 'company-request'
                });
            } catch (error) {
                logger.error('Failed to send company request notification', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userId: req.body.userId
                });
                res.status(500).json({ error: 'Failed to send notification' });
            }
        }
    );

    // Error handling middleware
    router.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Notification route error', {
            error: err.message,
            stack: err.stack,
            path: req.path
        });
        res.status(500).json({ error: 'Internal server error' });
    });

    return router;
}

// Export configured router
export const notificationRouter = initializeNotificationRoutes(new NotificationController());