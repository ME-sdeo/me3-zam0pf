/**
 * @file Redis configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Enterprise-grade Redis configuration with enhanced security, performance, and monitoring
 */

import Redis from 'ioredis'; // v5.3.0
import { ERROR_MESSAGES } from '../constants/error.constants';

/**
 * Redis connection options interface
 */
interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
  maxRetriesPerRequest: number;
  retryStrategy: {
    maxAttempts: number;
    delay: number;
    maxDelay: number;
    retryOnError: boolean;
  };
  enableReadyCheck: boolean;
  keepAlive: number;
  connectTimeout: number;
  disconnectTimeout: number;
  commandTimeout: number;
  autoResubscribe: boolean;
  autoResendUnfulfilledCommands: boolean;
  enableOfflineQueue: boolean;
  maxLoadingRetryTime: number;
}

/**
 * Redis caching options interface
 */
interface RedisCacheOptions {
  enabled: boolean;
  defaultTTL: number;
  sessionTTL: number;
  apiResponseTTL: number;
  maxMemoryPolicy: string;
  maxMemory: string;
  keyPrefix: string;
  scanCount: number;
  keyspaceNotifications: boolean;
  keyExpiryNotifications: boolean;
}

/**
 * Redis cluster options interface
 */
interface RedisClusterOptions {
  enabled: boolean;
  nodes: Array<{ host: string; port: number }>;
  options: {
    maxRedirections: number;
    retryDelayOnFailover: number;
    retryDelayOnClusterDown: number;
    enableOfflineQueue: boolean;
    enableReadyCheck: boolean;
    scaleReads: string;
    redisOptions: {
      password?: string;
      tls: boolean;
      enableAutoPipelining: boolean;
    };
  };
}

/**
 * Redis monitoring options interface
 */
interface RedisMonitoringOptions {
  enabled: boolean;
  metrics: {
    collectInterval: number;
    hitRatio: boolean;
    memoryUsage: boolean;
    commandStats: boolean;
    slowLogThreshold: number;
  };
  alerts: {
    memoryThreshold: number;
    connectionThreshold: number;
    errorRateThreshold: number;
  };
}

/**
 * Redis security options interface
 */
interface RedisSecurityOptions {
  encryptionAtRest: boolean;
  passwordRotationDays: number;
  maxClients: number;
  maxExecutionTime: number;
  requireAuth: boolean;
  tlsVersion: string;
  aclEnabled: boolean;
}

/**
 * Complete Redis configuration interface
 */
interface RedisConfig {
  connection: RedisConnectionOptions;
  caching: RedisCacheOptions;
  cluster: RedisClusterOptions;
  monitoring: RedisMonitoringOptions;
  security: RedisSecurityOptions;
}

/**
 * Validates Redis configuration settings
 * @throws Error if validation fails
 */
const validateRedisConfig = (): void => {
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  if (port < 1024 || port > 65535) {
    throw new Error(`${ERROR_MESSAGES.SYS_001}: Invalid Redis port configuration`);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
    throw new Error(`${ERROR_MESSAGES.SYS_001}: Redis password required in production`);
  }

  if (process.env.REDIS_CLUSTER_ENABLED === 'true' && !process.env.REDIS_CLUSTER_PASSWORD) {
    throw new Error(`${ERROR_MESSAGES.SYS_001}: Redis cluster password required when cluster is enabled`);
  }
};

/**
 * Redis configuration object with production-ready settings
 */
export const redisConfig: RedisConfig = {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    tls: process.env.NODE_ENV === 'production',
    maxRetriesPerRequest: 3,
    retryStrategy: {
      maxAttempts: 5,
      delay: 1000,
      maxDelay: 5000,
      retryOnError: true
    },
    enableReadyCheck: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    disconnectTimeout: 2000,
    commandTimeout: 5000,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    enableOfflineQueue: true,
    maxLoadingRetryTime: 5000
  },
  caching: {
    enabled: true,
    defaultTTL: 3600,
    sessionTTL: 86400,
    apiResponseTTL: 300,
    maxMemoryPolicy: 'volatile-lru',
    maxMemory: '2gb',
    keyPrefix: 'myelixir:',
    scanCount: 100,
    keyspaceNotifications: true,
    keyExpiryNotifications: true
  },
  cluster: {
    enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: [
      {
        host: process.env.REDIS_CLUSTER_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_CLUSTER_PORT, 10) || 6379
      }
    ],
    options: {
      maxRedirections: 16,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 100,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      scaleReads: 'all',
      redisOptions: {
        password: process.env.REDIS_CLUSTER_PASSWORD,
        tls: process.env.NODE_ENV === 'production',
        enableAutoPipelining: true
      }
    }
  },
  monitoring: {
    enabled: true,
    metrics: {
      collectInterval: 60000,
      hitRatio: true,
      memoryUsage: true,
      commandStats: true,
      slowLogThreshold: 1000
    },
    alerts: {
      memoryThreshold: 80,
      connectionThreshold: 90,
      errorRateThreshold: 5
    }
  },
  security: {
    encryptionAtRest: true,
    passwordRotationDays: 90,
    maxClients: 10000,
    maxExecutionTime: 5000,
    requireAuth: true,
    tlsVersion: 'TLSv1.2',
    aclEnabled: true
  }
};

// Validate configuration on module load
validateRedisConfig();

export default redisConfig;