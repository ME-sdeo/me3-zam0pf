/**
 * @file Main Express application configuration for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant middleware, secure routing, and enterprise-grade error handling
 */

import express, { Application, Request, Response, NextFunction } from 'express'; // version: 4.18.x
import helmet from 'helmet'; // version: 7.0.x
import cors from 'cors'; // version: 2.8.x
import compression from 'compression'; // version: 1.7.x
import rateLimit from 'express-rate-limit'; // version: 6.7.x
import morgan from 'morgan'; // version: 1.10.x
import * as applicationInsights from 'applicationinsights'; // version: 2.5.x
import { appConfig } from './config/app.config';
import { authRoutes } from './api/routes/auth.routes';
import { errorMiddleware, handleError } from './api/middlewares/error.middleware';
import { logger } from './utils/logger.util';

export class App {
  private app: Application;
  private server: any;
  private monitoring: applicationInsights.TelemetryClient;

  constructor() {
    this.app = express();
    this.initializeMonitoring();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  /**
   * Initializes Azure Application Insights monitoring
   */
  private initializeMonitoring(): void {
    if (appConfig.logging.applicationInsights.enabled) {
      applicationInsights.setup(appConfig.logging.applicationInsights.instrumentationKey)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .start();

      this.monitoring = applicationInsights.defaultClient;
      this.monitoring.context.tags[this.monitoring.context.keys.cloudRole] = 'myelixir-backend';
    }
  }

  /**
   * Configures Express middleware stack with security and performance optimizations
   */
  private configureMiddleware(): void {
    // Security headers
    this.app.use(helmet(appConfig.server.helmet));

    // CORS configuration
    this.app.use(cors(appConfig.server.corsOptions));

    // Request compression
    this.app.use(compression(appConfig.server.compression));

    // Rate limiting
    this.app.use(rateLimit(appConfig.server.rateLimit));

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging with PII protection
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.http(message.trim(), {
            component: 'http',
            timestamp: new Date().toISOString()
          });
        }
      },
      skip: (req: Request) => {
        return appConfig.logging.httpLogger.excludePaths.includes(req.path);
      }
    }));

    // Request correlation
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || 
        req.headers['x-request-id'] as string ||
        Math.random().toString(36).substring(7);
      res.setHeader('x-correlation-id', correlationId);
      next();
    });
  }

  /**
   * Configures API routes with versioning and security
   */
  private configureRoutes(): void {
    // Health check endpoint for Kubernetes
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API version prefix
    const apiPrefix = `${appConfig.api.prefix}/${appConfig.api.version}`;

    // Mount route handlers
    this.app.use(`${apiPrefix}/auth`, authRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Configures error handling middleware
   */
  private configureErrorHandling(): void {
    this.app.use(errorMiddleware);
  }

  /**
   * Starts the Express server with graceful shutdown
   */
  public async listen(): Promise<void> {
    const port = appConfig.server.port;
    const host = appConfig.server.host;

    // Create HTTP/HTTPS server based on environment
    if (appConfig.server.ssl.enabled && appConfig.env === 'production') {
      const https = require('https');
      const fs = require('fs');
      const options = {
        key: fs.readFileSync(appConfig.server.ssl.keyPath),
        cert: fs.readFileSync(appConfig.server.ssl.certPath)
      };
      this.server = https.createServer(options, this.app);
    } else {
      const http = require('http');
      this.server = http.createServer(this.app);
    }

    // Start server
    this.server.listen(port, host, () => {
      logger.info(`Server started on ${host}:${port}`, {
        component: 'server',
        environment: appConfig.env
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Implements graceful shutdown with connection draining
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Initiating graceful shutdown', { component: 'server' });

    // Stop accepting new connections
    this.server.close(async () => {
      try {
        // Close database connections
        // await db.disconnect();

        // Flush logs
        await new Promise(resolve => logger.on('finish', resolve));
        logger.end();

        // Exit process
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error, component: 'server' });
        process.exit(1);
      }
    });
  }
}

export default App;