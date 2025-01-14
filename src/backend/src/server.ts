/**
 * @file Entry point for MyElixir healthcare data marketplace backend server
 * @version 1.0.0
 * @description Initializes and manages the Express application with HIPAA compliance,
 * Kubernetes readiness, and enterprise-grade error handling
 */

import http from 'http';
import cluster from 'cluster';
import * as k8s from '@kubernetes/client-node'; // version: ^0.18.0
import { App } from './app';
import { appConfig } from './config/app.config';
import { logger } from './utils/logger.util';

// Constants for server configuration
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_WORKERS = process.env.NODE_ENV === 'production' ? 
  require('os').cpus().length : 1;

/**
 * Initializes Kubernetes health check client
 * @returns Configured Kubernetes API client
 */
const initializeK8sClient = (): k8s.KubeConfig => {
  const kc = new k8s.KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster();
  } else {
    kc.loadFromDefault();
  }
  return kc;
};

/**
 * Starts the server with clustering support and health checks
 */
async function startServer(): Promise<void> {
  try {
    // Initialize Kubernetes client if running in cluster
    if (process.env.KUBERNETES_SERVICE_HOST) {
      const kc = initializeK8sClient();
      const healthApi = kc.makeApiClient(k8s.CoreV1Api);
      
      // Register health check endpoint
      setInterval(async () => {
        try {
          await healthApi.readNamespacedPodStatus(
            process.env.POD_NAME!,
            process.env.POD_NAMESPACE!
          );
        } catch (error) {
          logger.error('Health check failed', { error });
        }
      }, HEALTH_CHECK_INTERVAL);
    }

    // Initialize clustering in production
    if (process.env.NODE_ENV === 'production' && cluster.isPrimary) {
      logger.info(`Primary ${process.pid} is running`);

      // Fork workers
      for (let i = 0; i < MAX_WORKERS; i++) {
        cluster.fork();
      }

      // Handle worker events
      cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died`, {
          code,
          signal,
          worker: worker.id
        });
        // Replace dead worker
        cluster.fork();
      });

      return;
    }

    // Initialize application
    const app = new App();
    const server = http.createServer(app.app);

    // Configure server timeouts
    server.timeout = appConfig.api.timeout;
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 120000;

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // Start server
    server.listen(appConfig.server.port, appConfig.server.host, () => {
      logger.info(`Server started`, {
        port: appConfig.server.port,
        host: appConfig.server.host,
        environment: process.env.NODE_ENV,
        workerId: cluster.worker?.id || 'primary'
      });

      // Log audit trail for server start
      logger.audit('server_start', {
        event: 'server_initialization',
        status: 'success',
        workerId: cluster.worker?.id || 'primary',
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    handleServerError(error);
  }
}

/**
 * Handles server startup and runtime errors
 * @param error - Error object
 */
function handleServerError(error: Error): void {
  const correlationId = process.env.CORRELATION_ID || 
    Math.random().toString(36).substring(7);

  logger.error('Server error occurred', {
    error,
    correlationId,
    timestamp: new Date().toISOString(),
    severity: 'CRITICAL'
  });

  // Log audit trail for server error
  logger.audit('server_error', {
    event: 'server_error',
    status: 'failure',
    correlationId,
    error: error.message,
    timestamp: new Date().toISOString()
  });

  // Exit process on critical errors
  process.exit(1);
}

/**
 * Configures graceful shutdown handlers
 * @param server - HTTP server instance
 */
function setupGracefulShutdown(server: http.Server): void {
  // Handle SIGTERM signal
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    gracefulShutdown(server, 'SIGTERM');
  });

  // Handle SIGINT signal
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Starting graceful shutdown...');
    gracefulShutdown(server, 'SIGINT');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    gracefulShutdown(server, 'uncaughtException');
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    gracefulShutdown(server, 'unhandledRejection');
  });
}

/**
 * Implements graceful shutdown with connection draining
 * @param server - HTTP server instance
 * @param signal - Shutdown signal type
 */
function gracefulShutdown(server: http.Server, signal: string): void {
  logger.info(`Starting graceful shutdown: ${signal}`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('Server closed. Cleaning up resources...');

    try {
      // Wait for existing connections to complete
      await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));

      // Log audit trail for shutdown
      logger.audit('server_shutdown', {
        event: 'server_shutdown',
        signal,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      // Exit process
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

// Start the server
startServer().catch(handleServerError);