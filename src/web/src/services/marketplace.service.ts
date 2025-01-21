/**
 * Marketplace Service
 * Implements secure healthcare data marketplace operations with HIPAA compliance and blockchain integration
 * @version 1.0.0
 */

import { Logger } from '@azure/logger'; // @azure/logger ^1.0.0
import { RequestStatus, TransactionStatus } from '../types/marketplace.types';
import { UUID } from 'crypto';

import * as marketplaceApi from '../api/marketplace.api';
import { IDataRequest } from '../interfaces/marketplace.interface';
import { FHIRValidationErrorType } from '../types/fhir.types';

// Global constants for marketplace operations
const MIN_MATCH_SCORE = 0.7;
const MIN_PRICE_PER_RECORD = 0.1;
const MAX_REQUEST_DURATION_DAYS = 30;
const HIPAA_COMPLIANCE_LEVEL = 'strict';
const BLOCKCHAIN_RETRY_ATTEMPTS = 3;

/**
 * Enhanced marketplace service class implementing secure data exchange operations
 */
export class MarketplaceService {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Creates a new HIPAA-compliant data request with blockchain tracking
   * @param request - Data request details
   * @returns Created request with compliance metadata
   */
  public async createRequest(request: IDataRequest): Promise<IDataRequest> {
    try {
      // Validate request against HIPAA requirements
      const validationResult = await this.validateRequest(request);
      if (!validationResult.isValid) {
        this.logger.error('Request validation failed', { errors: validationResult.errors });
        throw new Error('Invalid request format');
      }

      // Validate FHIR compatibility
      const fhirValidation = await marketplaceApi.validateFHIR(request.filterCriteria);
      if (!fhirValidation.valid) {
        throw new Error('Invalid FHIR criteria');
      }

      // Set initial request status
      const enhancedRequest = {
        ...request,
        status: RequestStatus.DRAFT,
        complianceMetadata: {
          hipaaCompliant: true,
          validationTimestamp: new Date().toISOString(),
          complianceLevel: HIPAA_COMPLIANCE_LEVEL
        }
      };

      // Create request through API
      const createdRequest = await marketplaceApi.createDataRequest(enhancedRequest);

      // Record transaction in blockchain
      await this.recordBlockchainTransaction(createdRequest.id, 'REQUEST_CREATED');

      // Audit logging
      this.logger.info('Data request created', {
        requestId: createdRequest.id,
        companyId: createdRequest.companyId,
        timestamp: new Date().toISOString()
      });

      return createdRequest;
    } catch (error) {
      this.logger.error('Error creating data request', { error });
      throw error;
    }
  }

  /**
   * Updates an existing data request with security validation
   * @param requestId - UUID of request to update
   * @param updates - Request updates
   * @returns Updated request
   */
  public async updateRequest(
    requestId: UUID,
    updates: Partial<IDataRequest>
  ): Promise<IDataRequest> {
    try {
      // Validate updates
      if (updates.filterCriteria) {
        const validationResult = await this.validateRequest({
          ...updates,
          id: requestId
        } as IDataRequest);
        if (!validationResult.isValid) {
          throw new Error('Invalid update data');
        }
      }

      // Update request
      const updatedRequest = await marketplaceApi.updateDataRequest(requestId, updates);

      // Record in blockchain
      await this.recordBlockchainTransaction(requestId, 'REQUEST_UPDATED');

      // Audit logging
      this.logger.info('Data request updated', {
        requestId,
        updates: Object.keys(updates),
        timestamp: new Date().toISOString()
      });

      return updatedRequest;
    } catch (error) {
      this.logger.error('Error updating data request', { error, requestId });
      throw error;
    }
  }

  /**
   * Retrieves matches for a data request with security checks
   * @param requestId - UUID of request
   * @returns Array of matches
   */
  public async getRequestMatches(requestId: UUID) {
    try {
      const matches = await marketplaceApi.getMatches(requestId);

      // Filter matches based on minimum score
      const validMatches = matches.filter(match => match.score >= MIN_MATCH_SCORE);

      // Audit logging
      this.logger.info('Matches retrieved', {
        requestId,
        matchCount: validMatches.length,
        timestamp: new Date().toISOString()
      });

      return validMatches;
    } catch (error) {
      this.logger.error('Error retrieving matches', { error, requestId });
      throw error;
    }
  }

  /**
   * Calculates pricing for data request with market analysis
   * @param filterCriteria - Request criteria
   * @returns Price calculation
   */
  public async calculateRequestPrice(filterCriteria: {
    resourceTypes: string[];
    demographics: any;
    conditions: string[];
    dateRange: { startDate: Date; endDate: Date };
  }) {
    try {
      const pricing = await marketplaceApi.calculatePrice(filterCriteria);

      // Validate minimum price requirements
      if (pricing.totalPrice / pricing.estimatedMatches < MIN_PRICE_PER_RECORD) {
        throw new Error('Price per record below minimum threshold');
      }

      return pricing;
    } catch (error) {
      this.logger.error('Error calculating price', { error });
      throw error;
    }
  }

  /**
   * Records transaction in blockchain with retry mechanism
   * @param requestId - UUID of request
   * @param action - Transaction action
   */
  private async recordBlockchainTransaction(requestId: UUID, action: string): Promise<void> {
    let attempts = 0;
    while (attempts < BLOCKCHAIN_RETRY_ATTEMPTS) {
      try {
        await marketplaceApi.trackBlockchain({
          requestId,
          action,
          timestamp: new Date().toISOString(),
          status: TransactionStatus.COMPLETED
        });
        return;
      } catch (error) {
        attempts++;
        if (attempts === BLOCKCHAIN_RETRY_ATTEMPTS) {
          this.logger.error('Blockchain recording failed', { error, requestId, action });
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }

  /**
   * Validates request against HIPAA compliance requirements
   * @param request - Request to validate
   * @returns Validation result
   */
  private async validateRequest(request: IDataRequest) {
    const errors = [];

    // Validate price
    if (request.pricePerRecord < MIN_PRICE_PER_RECORD) {
      errors.push({
        type: FHIRValidationErrorType.Value,
        field: 'pricePerRecord',
        message: 'Price per record below minimum threshold'
      });
    }

    // Validate duration
    const duration = Math.ceil(
      (new Date(request.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (duration > MAX_REQUEST_DURATION_DAYS) {
      errors.push({
        type: FHIRValidationErrorType.Value,
        field: 'expiresAt',
        message: 'Request duration exceeds maximum allowed'
      });
    }

    // Validate filter criteria
    if (!request.filterCriteria.resourceTypes?.length) {
      errors.push({
        type: FHIRValidationErrorType.Required,
        field: 'filterCriteria.resourceTypes',
        message: 'At least one resource type required'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export default MarketplaceService;