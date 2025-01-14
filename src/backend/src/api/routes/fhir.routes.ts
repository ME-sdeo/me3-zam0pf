/**
 * @file FHIR resource routes configuration implementing secure, HIPAA-compliant endpoints
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.0
import correlator from 'express-correlation-id'; // ^2.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import winston from 'winston'; // ^3.8.0
import cacheManager from 'cache-manager'; // ^5.2.0
import circuitBreaker from 'express-circuit-breaker'; // ^2.0.0
import { body } from 'express-validator'; // ^7.0.0

import { FHIRController } from '../controllers/fhir.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateFHIRRequest, validateFHIRSearchParams } from '../validators/fhir.validator';

// Initialize cache manager
const cache = cacheManager.caching({ store: 'memory', max: 1000, ttl: 300 });

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'fhir-routes' }
});

/**
 * Configures and returns Express router with enhanced FHIR endpoints
 * Implements comprehensive security, monitoring, and caching
 */
export function configureFHIRRoutes(controller: FHIRController): Router {
  const router = Router();

  // Apply correlation ID middleware for request tracing
  router.use(correlator());

  // Configure rate limiting per endpoint
  const createRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later'
  });

  const readRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 1000
  });

  const searchRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 500
  });

  // Configure circuit breaker
  const breakerOptions = {
    timeout: 15000, // 15 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 30000 // 30 seconds
  };

  // Configure security headers
  router.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    next();
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // FHIR Resource endpoints with comprehensive security and validation
  router.post('/:resourceType',
    createRateLimit,
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    validateFHIRRequest,
    body().custom(body => Buffer.byteLength(JSON.stringify(body)) <= 5242880), // 5MB limit
    controller.createResource
  );

  router.get('/:resourceType/:id',
    readRateLimit,
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    async (req, res, next) => {
      const cacheKey = `${req.params.resourceType}:${req.params.id}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      next();
    },
    controller.getResource
  );

  router.put('/:resourceType/:id',
    createRateLimit,
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    validateFHIRRequest,
    body().custom(body => Buffer.byteLength(JSON.stringify(body)) <= 5242880),
    controller.updateResource
  );

  router.delete('/:resourceType/:id',
    rateLimit({ windowMs: 60 * 1000, max: 50 }),
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    controller.deleteResource
  );

  router.get('/:resourceType/_search',
    searchRateLimit,
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    validateFHIRSearchParams,
    async (req, res, next) => {
      const cacheKey = `search:${req.params.resourceType}:${JSON.stringify(req.query)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      next();
    },
    controller.searchResources
  );

  router.post('/$validate',
    rateLimit({ windowMs: 60 * 1000, max: 200 }),
    circuitBreaker(breakerOptions),
    authenticate,
    authorize(['consumer', 'company']),
    validateFHIRRequest,
    controller.validateResource
  );

  // Error handling middleware
  router.use((err: any, req: any, res: any, next: any) => {
    logger.error('FHIR route error:', {
      error: err.message,
      path: req.path,
      method: req.method,
      correlationId: req.correlationId()
    });

    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      correlationId: req.correlationId()
    });
  });

  return router;
}

export default configureFHIRRoutes;