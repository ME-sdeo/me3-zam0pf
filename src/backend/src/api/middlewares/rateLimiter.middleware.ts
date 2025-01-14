/**
 * @file Rate limiter middleware for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements distributed rate limiting using Redis with enhanced security and monitoring
 */

import rateLimit from 'express-rate-limit'; // v6.7.0
import RedisStore from 'rate-limit-redis'; // v3.0.0
import Redis from 'ioredis'; // v5.3.0
import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { redisConfig } from '../../config/redis.config';
import { ERROR_MESSAGES } from '../../constants/error.constants';

// Default rate limiting constants
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const DEFAULT_MAX_REQUESTS = 1000;

// Initialize Redis client with cluster support
const redisClient = new Redis(redisConfig.connection);

/**
 * Factory function to create rate limiter middleware with enhanced features
 */
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skipFailedRequests?: boolean;
}) => {
  const store = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: `${redisConfig.caching.keyPrefix}ratelimit:`,
    resetExpiryOnChange: true,
    // Implement custom key expiry handling
    onExpire: (key: string) => {
      if (redisConfig.monitoring.enabled) {
        // Log rate limit expiry for monitoring
        console.info(`Rate limit expired for key: ${key}`);
      }
    }
  });

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator: options.keyGenerator || ((req) => {
      // Default key generator using IP and route
      return `${req.ip}:${req.path}`;
    }),
    handler: options.handler || ((req, res) => {
      res.status(429).json({
        error: ERROR_MESSAGES.SYS_001,
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }),
    skip: (req) => {
      // Skip rate limiting for health checks from trusted sources
      if (req.path === '/health' && req.headers['x-health-check']) {
        return true;
      }
      return false;
    },
    skipFailedRequests: options.skipFailedRequests || false,
    // Add security headers
    headers: {
      'Retry-After': 'X-RateLimit-Reset',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }
  });
};

/**
 * Rate limiter for public API endpoints
 * Limits: 1000 requests per hour
 */
export const publicApiLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: DEFAULT_MAX_REQUESTS,
  skipFailedRequests: true
});

/**
 * Rate limiter for authenticated user API endpoints
 * Limits: 5000 requests per hour
 */
export const userApiLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: 5000,
  keyGenerator: (req: Request) => {
    // Use user ID for authenticated endpoints
    return `user:${req.user?.id}:${req.path}`;
  }
});

/**
 * Rate limiter for admin API endpoints
 * Limits: 1000 requests per hour
 */
export const adminApiLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: 1000,
  keyGenerator: (req: Request) => {
    // Use admin ID for admin endpoints
    return `admin:${req.user?.id}:${req.path}`;
  }
});

/**
 * Rate limiter for health check endpoints
 * Limits: 100 requests per minute
 */
export const healthApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  skipFailedRequests: true,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: ERROR_MESSAGES.SYS_001,
      status: 'error',
      message: 'Too many health check requests'
    });
  }
});

// Error handling for Redis connection
redisClient.on('error', (error) => {
  console.error('Redis rate limiter error:', error);
  // Fallback to memory store if Redis is unavailable
  const memoryStore = new Map();
  store.client = memoryStore;
});

// Monitoring integration
if (redisConfig.monitoring.enabled) {
  redisClient.on('connect', () => {
    console.info('Rate limiter Redis connection established');
  });
  
  redisClient.on('ready', () => {
    console.info('Rate limiter Redis client ready');
  });
}