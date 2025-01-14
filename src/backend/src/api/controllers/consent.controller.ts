/**
 * HIPAA-compliant consent management controller for MyElixir healthcare data marketplace
 * Implements secure consent operations with blockchain tracking and granular access controls
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { 
  controller, 
  httpPost, 
  httpPut, 
  httpGet, 
  authorize 
} from 'inversify-express-utils'; // v6.4.3
import { Request, Response } from 'express'; // v4.18.2
import { Logger } from 'winston'; // v3.8.2
import { RateLimit } from 'express-rate-limit'; // v6.7.0
import { ConsentService } from '../../services/consent.service';
import { IConsent } from '../../interfaces/consent.interface';
import { validateConsent } from '../validators/consent.validator';
import { RedisCache } from '../../utils/cache.util';
import { MetricsCollector } from '../../utils/metrics.util';
import { CircuitBreaker } from 'opossum'; // v6.0.0

@injectable()
@controller('/api/v1/consents')
@RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many consent requests, please try again later'
})
export class ConsentController {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly consentService: ConsentService,
    private readonly logger: Logger,
    private readonly cache: RedisCache,
    private readonly metrics: MetricsCollector
  ) {
    // Initialize circuit breaker for blockchain operations
    this.circuitBreaker = new CircuitBreaker(
      async (operation: () => Promise<any>) => operation(),
      {
        timeout: 10000, // 10 seconds
        errorThresholdPercentage: 50,
        resetTimeout: 30000 // 30 seconds
      }
    );
  }

  /**
   * Creates a new HIPAA-compliant consent record with blockchain verification
   * @route POST /api/v1/consents
   */
  @httpPost('/')
  @authorize(['user', 'company'])
  async createConsent(req: Request, res: Response): Promise<Response> {
    try {
      const startTime = Date.now();
      this.logger.info('Creating new consent record', {
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      // Validate consent data
      const validationResult = await validateConsent(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          errors: validationResult.errors
        });
      }

      // Create consent with blockchain tracking
      const consent = await this.circuitBreaker.fire(async () => {
        return await this.consentService.createConsent(req.body);
      });

      // Track metrics
      this.metrics.recordLatency('consent.create', Date.now() - startTime);
      this.metrics.incrementCounter('consent.created');

      return res.status(201).json({
        success: true,
        data: consent
      });
    } catch (error) {
      this.logger.error('Failed to create consent record', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Updates consent status with blockchain verification
   * @route PUT /api/v1/consents/:id/status
   */
  @httpPut('/:id/status')
  @authorize(['user', 'company'])
  async updateConsentStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      this.logger.info('Updating consent status', {
        consentId: id,
        newStatus: status,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      // Update consent with blockchain verification
      const updatedConsent = await this.circuitBreaker.fire(async () => {
        return await this.consentService.updateConsentStatus(id, status);
      });

      // Invalidate cache
      await this.cache.del(`consent:${id}`);

      // Track metrics
      this.metrics.incrementCounter('consent.updated');

      return res.status(200).json({
        success: true,
        data: updatedConsent
      });
    } catch (error) {
      this.logger.error('Failed to update consent status', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Retrieves paginated user consents with blockchain verification
   * @route GET /api/v1/consents/user/:userId
   */
  @httpGet('/user/:userId')
  @authorize(['user'])
  async getUserConsents(req: Request, res: Response): Promise<Response> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Check cache
      const cacheKey = `user-consents:${userId}:${page}:${limit}`;
      const cachedResult = await this.cache.get(cacheKey);
      if (cachedResult) {
        return res.status(200).json({
          success: true,
          data: JSON.parse(cachedResult)
        });
      }

      // Retrieve consents with blockchain verification
      const consents = await this.circuitBreaker.fire(async () => {
        return await this.consentService.getUserConsents(userId, {
          page: Number(page),
          limit: Number(limit)
        });
      });

      // Cache results
      await this.cache.set(
        cacheKey,
        JSON.stringify(consents),
        this.CACHE_TTL
      );

      // Track metrics
      this.metrics.incrementCounter('consent.retrieved');

      return res.status(200).json({
        success: true,
        data: consents
      });
    } catch (error) {
      this.logger.error('Failed to retrieve user consents', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default ConsentController;