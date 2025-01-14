/**
 * HIPAA-compliant healthcare data marketplace service with blockchain integration
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // ^6.0.1
import { Logger } from 'winston'; // ^3.8.2
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { BlockchainService } from '@hyperledger/fabric-gateway'; // ^1.1.1
import { ConsentService } from './consent.service';
import { DataRequest, RequestStatus, MarketplaceTransaction, DataMatch } from '../interfaces/marketplace.interface';
import { Request } from '../models/request.model';
import { validateFHIRResource } from '../utils/validation.util';

@injectable()
export class MarketplaceService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly MIN_MATCH_SCORE = 0.85;
  private readonly MIN_PRICE_PER_RECORD = 0.5;
  private readonly MAX_REQUEST_DURATION_DAYS = 30;
  private readonly COMPLIANCE_CHECK_INTERVAL = 300000; // 5 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 5000;

  constructor(
    private readonly logger: Logger,
    private readonly consentService: ConsentService,
    private readonly blockchainService: BlockchainService
  ) {
    // Initialize circuit breaker for external service calls
    this.circuitBreaker = new CircuitBreaker(
      async (operation: () => Promise<any>) => operation(),
      {
        timeout: this.CIRCUIT_BREAKER_TIMEOUT,
        resetTimeout: 30000,
        errorThresholdPercentage: 50
      }
    );

    // Start periodic compliance checks
    this.startComplianceChecks();
  }

  /**
   * Creates a new HIPAA-compliant data request with blockchain tracking
   * @param requestData Data request details
   * @returns Created request with compliance status
   */
  public async createDataRequest(requestData: DataRequest): Promise<DataRequest> {
    try {
      this.logger.info('Creating new data request', {
        companyId: requestData.companyId,
        timestamp: new Date().toISOString()
      });

      // Validate request data
      await this.validateRequestData(requestData);

      // Create request with compliance metadata
      const request = new Request({
        ...requestData,
        status: RequestStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: this.calculateExpiryDate(requestData)
      });

      // Record request on blockchain
      const blockchainRef = await this.circuitBreaker.fire(async () => {
        return await this.blockchainService.submitTransaction(
          'CreateRequest',
          JSON.stringify(request)
        );
      });

      request.blockchainRef = blockchainRef;

      // Save request with audit trail
      const savedRequest = await request.save();

      this.logger.info('Data request created successfully', {
        requestId: savedRequest.id,
        blockchainRef,
        timestamp: new Date().toISOString()
      });

      return savedRequest;
    } catch (error) {
      this.logger.error('Failed to create data request', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Finds matching health records with compliance verification
   * @param requestId Request ID to match
   * @returns Array of compliance-verified matches
   */
  public async findMatchingRecords(requestId: string): Promise<DataMatch[]> {
    try {
      this.logger.info('Finding matching records', {
        requestId,
        timestamp: new Date().toISOString()
      });

      // Get request details
      const request = await Request.findById(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      // Verify request compliance status
      const complianceValid = await this.verifyRequestCompliance(request);
      if (!complianceValid) {
        throw new Error('Request does not meet compliance requirements');
      }

      // Find potential matches
      const matches = await this.findPotentialMatches(request);

      // Verify consent for each match
      const verifiedMatches = await Promise.all(
        matches.map(async (match) => {
          const consentValid = await this.consentService.verifyUserConsentsWithBlockchain(
            match.resourceId,
            request.companyId
          );

          return {
            ...match,
            consentStatus: consentValid ? 'VALID' : 'INVALID'
          };
        })
      );

      // Filter matches based on compliance and consent
      const validMatches = verifiedMatches.filter(
        match => match.score >= this.MIN_MATCH_SCORE && match.consentStatus === 'VALID'
      );

      // Record matching operation on blockchain
      await this.recordMatchingOperation(requestId, validMatches);

      return validMatches;
    } catch (error) {
      this.logger.error('Failed to find matching records', {
        requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Processes marketplace transaction with blockchain verification
   * @param requestId Request ID
   * @param providerId Provider ID
   * @param resourceIds Resource IDs
   * @returns Processed transaction with blockchain reference
   */
  public async processTransaction(
    requestId: string,
    providerId: string,
    resourceIds: string[]
  ): Promise<MarketplaceTransaction> {
    try {
      this.logger.info('Processing marketplace transaction', {
        requestId,
        providerId,
        timestamp: new Date().toISOString()
      });

      // Verify request and compliance status
      const request = await Request.findById(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      // Verify consent status
      const consentValid = await this.consentService.verifyUserConsentsWithBlockchain(
        providerId,
        request.companyId
      );

      if (!consentValid) {
        throw new Error('Invalid consent status');
      }

      // Calculate transaction amount
      const amount = this.calculateTransactionAmount(request, resourceIds.length);

      // Create blockchain transaction
      const transaction: MarketplaceTransaction = {
        id: crypto.randomUUID(),
        requestId,
        providerId,
        companyId: request.companyId,
        resourceIds,
        amount,
        status: 'PROCESSING',
        createdAt: new Date(),
        auditTrail: []
      };

      // Submit transaction to blockchain
      const blockchainRef = await this.circuitBreaker.fire(async () => {
        return await this.blockchainService.submitTransaction(
          'ProcessTransaction',
          JSON.stringify(transaction)
        );
      });

      transaction.blockchainRef = blockchainRef;

      // Update request status
      await Request.updateRequestStatus(requestId, RequestStatus.COMPLETED);

      this.logger.info('Transaction processed successfully', {
        transactionId: transaction.id,
        blockchainRef,
        timestamp: new Date().toISOString()
      });

      return transaction;
    } catch (error) {
      this.logger.error('Failed to process transaction', {
        requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validates request data against HIPAA compliance requirements
   */
  private async validateRequestData(requestData: DataRequest): Promise<void> {
    // Validate price per record
    if (requestData.pricePerRecord < this.MIN_PRICE_PER_RECORD) {
      throw new Error(`Price per record must be at least ${this.MIN_PRICE_PER_RECORD}`);
    }

    // Validate FHIR compliance
    const validationResult = await validateFHIRResource(requestData.filterCriteria);
    if (!validationResult.valid) {
      throw new Error(`FHIR validation failed: ${validationResult.errors[0].message}`);
    }

    // Validate request duration
    const duration = this.calculateRequestDuration(requestData);
    if (duration > this.MAX_REQUEST_DURATION_DAYS) {
      throw new Error(`Request duration cannot exceed ${this.MAX_REQUEST_DURATION_DAYS} days`);
    }
  }

  /**
   * Starts periodic compliance checks for active requests
   */
  private startComplianceChecks(): void {
    setInterval(async () => {
      try {
        const activeRequests = await Request.findActiveRequestsWithAudit();
        for (const request of activeRequests) {
          const complianceValid = await this.verifyRequestCompliance(request);
          if (!complianceValid) {
            await Request.updateRequestStatus(request.id, RequestStatus.COMPLIANCE_REVIEW);
          }
        }
      } catch (error) {
        this.logger.error('Compliance check failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, this.COMPLIANCE_CHECK_INTERVAL);
  }

  /**
   * Verifies request compliance status
   */
  private async verifyRequestCompliance(request: DataRequest): Promise<boolean> {
    try {
      const validationResult = await validateFHIRResource(request.filterCriteria);
      return validationResult.valid;
    } catch (error) {
      this.logger.error('Compliance verification failed', {
        requestId: request.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Records matching operation on blockchain
   */
  private async recordMatchingOperation(
    requestId: string,
    matches: DataMatch[]
  ): Promise<void> {
    try {
      await this.blockchainService.submitTransaction(
        'RecordMatching',
        JSON.stringify({
          requestId,
          matchCount: matches.length,
          timestamp: new Date()
        })
      );
    } catch (error) {
      this.logger.error('Failed to record matching operation', {
        requestId,
        error: error.message
      });
    }
  }

  /**
   * Calculates transaction amount based on request parameters
   */
  private calculateTransactionAmount(
    request: DataRequest,
    resourceCount: number
  ): number {
    return request.pricePerRecord * resourceCount;
  }

  /**
   * Calculates request expiry date
   */
  private calculateExpiryDate(request: DataRequest): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.MAX_REQUEST_DURATION_DAYS);
    return expiryDate;
  }

  /**
   * Calculates request duration in days
   */
  private calculateRequestDuration(request: DataRequest): number {
    const start = new Date(request.createdAt);
    const end = new Date(request.expiresAt);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export default MarketplaceService;