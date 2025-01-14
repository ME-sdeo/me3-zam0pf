/**
 * @file Payment routes configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant payment processing routes with security, audit logging, and monitoring
 */

import express, { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import winston from 'winston'; // ^3.8.2
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { errorHandler } from '../middlewares/error.middleware';

// Initialize secure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'payment-routes' },
    transports: [
        new winston.transports.File({ filename: 'payment-audit.log' }),
        new winston.transports.Console()
    ]
});

// Configure rate limiters with progressive thresholds
const paymentIntentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many payment intent requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const paymentProcessLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // 50 requests per window
    message: 'Too many payment processing requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const paymentRefundLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25, // 25 requests per window
    message: 'Too many refund requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Initializes payment routes with comprehensive security middleware
 * @returns Configured Express router
 */
const initializeRoutes = (): Router => {
    const router = express.Router();
    const controller = new PaymentController();

    // Apply security headers
    router.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'"],
                connectSrc: ["'self'", 'https://*.stripe.com'],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    // Payment Intent Route
    router.post('/intent',
        paymentIntentLimiter,
        authenticate,
        authorize(['company']),
        validateRequest,
        async (req, res, next) => {
            try {
                logger.info('Payment intent request received', {
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                await controller.createPaymentIntent(req, res, next);
            } catch (error) {
                logger.error('Payment intent creation failed', {
                    error: error.message,
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                next(error);
            }
        }
    );

    // Payment Processing Route
    router.post('/process',
        paymentProcessLimiter,
        authenticate,
        authorize(['company']),
        validateRequest,
        async (req, res, next) => {
            try {
                logger.info('Payment processing request received', {
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                await controller.processPayment(req, res, next);
            } catch (error) {
                logger.error('Payment processing failed', {
                    error: error.message,
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                next(error);
            }
        }
    );

    // Payment Refund Route
    router.post('/refund',
        paymentRefundLimiter,
        authenticate,
        authorize(['admin']),
        validateRequest,
        async (req, res, next) => {
            try {
                logger.info('Refund request received', {
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                await controller.refundPayment(req, res, next);
            } catch (error) {
                logger.error('Payment refund failed', {
                    error: error.message,
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
                next(error);
            }
        }
    );

    // Apply global error handler
    router.use(errorHandler);

    return router;
};

// Initialize and export router
const router = initializeRoutes();
export default router;