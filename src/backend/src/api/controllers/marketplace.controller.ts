/**
 * HIPAA-compliant controller for healthcare data marketplace operations
 * Implements secure data exchange with blockchain tracking and audit logging
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // ^6.0.1
import { 
  controller, 
  httpPost, 
  httpGet, 
  httpPut, 
  middleware,
  request,
  response 
} from 'routing-controllers'; // ^0.10.0
import { Logger } from 'winston'; // ^3.8.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import helmet from 'helmet'; // ^7.0.0
import { SecurityMiddleware } from '@company/security-middleware'; // ^1.0.0

import { MarketplaceService } from '../../services/marketplace.service';
import { 
  DataRequest, 
  RequestStatus, 
  MarketplaceTransaction,
  TransactionStatus 
} from '../../interfaces/marketplace.interface';
import { 
  validateDataRequest,
  validateMarketplaceTransaction 
} from '../validators/marketplace.validator';
import { FHIRValidationResult } from '../../interfaces/fhir.interface';

// Rate limiting configuration for DDOS protection
const rateLimitConfig = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

@injectable()
@controller('/api/v1/marketplace')
@middleware([SecurityMiddleware, helmet(), rateLimitConfig])
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly logger: Logger,
    private readonly securityMiddleware: SecurityMiddleware
  ) {}

  /**
   * Creates a new HIPAA-compliant data request with blockchain tracking
   * @param request Data request details
   * @returns Created request with compliance validation
   */
  @httpPost('/requests')
  @middleware([rateLimitConfig])
  async createRequest(
    @request() req: any,
    @response() res: any
  ): Promise<DataRequest> {
    try {
      this.logger.info('Creating new data request', {
        userId: req.user.id,
        timestamp: new Date().toISOString()
      });

      // Validate request data
      const requestData: DataRequest = req.body;
      const isValid = await validateDataRequest(requestData);
      if (!isValid) {
        throw new Error('Invalid request data');
      }

      // Create request with blockchain tracking
      const createdRequest = await this.marketplaceService.createDataRequest(requestData);

      this.logger.info('Data request created successfully', {
        requestId: createdRequest.id,
        userId: req.user.id,
        timestamp: new Date().toISOString()
      });

      return createdRequest;
    } catch (error) {
      this.logger.error('Failed to create data request', {
        error: error.message,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Retrieves company's data requests with compliance status
   * @param companyId Company ID
   * @returns Array of data requests
   */
  @httpGet('/requests/:companyId')
  async getCompanyRequests(
    @request() req: any
  ): Promise<DataRequest[]> {
    try {
      const { companyId } = req.params;

      this.logger.info('Retrieving company requests', {
        companyId,
        timestamp: new Date().toISOString()
      });

      const requests = await this.marketplaceService.getCompanyRequests(companyId);

      return requests;
    } catch (error) {
      this.logger.error('Failed to retrieve company requests', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Finds matching records for a data request with HIPAA compliance verification
   * @param requestId Request ID
   * @returns Matching records with compliance status
   */
  @httpGet('/requests/:requestId/matches')
  async findMatches(
    @request() req: any
  ): Promise<{ matches: any[], complianceStatus: FHIRValidationResult }> {
    try {
      const { requestId } = req.params;

      this.logger.info('Finding matches for request', {
        requestId,
        timestamp: new Date().toISOString()
      });

      const matches = await this.marketplaceService.findMatchingRecords(requestId);

      return matches;
    } catch (error) {
      this.logger.error('Failed to find matches', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Processes a marketplace transaction with blockchain verification
   * @param transaction Transaction details
   * @returns Processed transaction with blockchain reference
   */
  @httpPost('/transactions')
  async processTransaction(
    @request() req: any
  ): Promise<MarketplaceTransaction> {
    try {
      const transaction: MarketplaceTransaction = req.body;

      this.logger.info('Processing marketplace transaction', {
        requestId: transaction.requestId,
        timestamp: new Date().toISOString()
      });

      // Validate transaction
      const isValid = await validateMarketplaceTransaction(transaction);
      if (!isValid) {
        throw new Error('Invalid transaction data');
      }

      // Process transaction with blockchain tracking
      const processedTransaction = await this.marketplaceService.processTransaction(
        transaction.requestId,
        transaction.providerId,
        transaction.resourceIds
      );

      return processedTransaction;
    } catch (error) {
      this.logger.error('Failed to process transaction', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Updates request status with compliance verification
   * @param requestId Request ID
   * @param status New status
   * @returns Updated request
   */
  @httpPut('/requests/:requestId/status')
  async updateRequestStatus(
    @request() req: any
  ): Promise<DataRequest> {
    try {
      const { requestId } = req.params;
      const { status } = req.body;

      if (!Object.values(RequestStatus).includes(status)) {
        throw new Error('Invalid request status');
      }

      this.logger.info('Updating request status', {
        requestId,
        status,
        timestamp: new Date().toISOString()
      });

      const updatedRequest = await this.marketplaceService.updateRequestStatus(
        requestId,
        status
      );

      return updatedRequest;
    } catch (error) {
      this.logger.error('Failed to update request status', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

export default MarketplaceController;