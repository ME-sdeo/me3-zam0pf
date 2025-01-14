import { QueueOptions, JobOptions } from 'bull'; // bull@^4.10.0
import { Redis } from 'ioredis'; // ioredis@^5.3.0

/**
 * Queue names constants for consistent reference across the application
 */
export enum QUEUE_NAMES {
  CONSENT = 'consent-queue',
  MARKETPLACE = 'marketplace-queue',
  NOTIFICATION = 'notification-queue',
  PAYMENT = 'payment-queue'
}

/**
 * Priority levels for queue jobs
 * Lower number indicates higher priority
 */
export const QUEUE_PRIORITIES = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
} as const;

/**
 * Redis connection options interface
 */
interface RedisConnectionOptions {
  host: string;
  port: number;
  password: string;
  tls?: boolean;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
}

/**
 * Queue definitions interface for type safety
 */
interface QueueDefinitions {
  [key: string]: {
    name: string;
    priority: number;
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    rateLimiter?: {
      max: number;
      duration: number;
    };
  };
}

/**
 * Main queue configuration interface
 */
interface QueueConfig {
  connection: RedisConnectionOptions;
  defaultJobOptions: JobOptions;
  queues: QueueDefinitions;
}

/**
 * Centralized queue configuration for the application
 */
export const queueConfig: QueueConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    tls: process.env.NODE_ENV === 'production',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true
  },

  defaultJobOptions: {
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000
    },
    removeOnFail: {
      age: 604800 // 7 days
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 seconds
    }
  },

  queues: {
    consent: {
      name: QUEUE_NAMES.CONSENT,
      priority: QUEUE_PRIORITIES.HIGH,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // 5 seconds
      }
    },
    marketplace: {
      name: QUEUE_NAMES.MARKETPLACE,
      priority: QUEUE_PRIORITIES.HIGH,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    },
    notification: {
      name: QUEUE_NAMES.NOTIFICATION,
      priority: QUEUE_PRIORITIES.MEDIUM,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 300000 // 5 minutes
      }
    },
    payment: {
      name: QUEUE_NAMES.PAYMENT,
      priority: QUEUE_PRIORITIES.HIGH,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      rateLimiter: {
        max: 100, // Maximum 100 jobs
        duration: 60000 // Per minute
      }
    }
  }
};

/**
 * Create Redis client instance with configured options
 */
export const createRedisClient = (): Redis => {
  return new Redis({
    host: queueConfig.connection.host,
    port: queueConfig.connection.port,
    password: queueConfig.connection.password,
    tls: queueConfig.connection.tls ? {} : undefined,
    maxRetriesPerRequest: queueConfig.connection.maxRetriesPerRequest,
    enableReadyCheck: queueConfig.connection.enableReadyCheck,
    retryStrategy: (times: number) => {
      return Math.min(times * 50, 2000); // Exponential backoff with max 2s delay
    }
  });
};

export default queueConfig;