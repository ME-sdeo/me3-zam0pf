import { describe, expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import { Logger } from 'winston';
import { BlockchainService } from '@blockchain/service';
import { MarketplaceService } from '../../../src/services/marketplace.service';
import { ValidationUtil } from '../../../src/utils/validation.util';
import { 
  DataRequest, 
  RequestStatus, 
  DataMatch, 
  MarketplaceTransaction,
  MatchStatus,
  TransactionStatus,
  ComplianceLevel
} from '../../../src/interfaces/marketplace.interface';
import { FHIRValidationResult } from '../../../src/interfaces/fhir.interface';
import { ConsentService } from '../../../src/services/consent.service';

// Mock dependencies
jest.mock('winston');
jest.mock('@blockchain/service');
jest.mock('../../../src/utils/validation.util');
jest.mock('../../../src/services/consent.service');

describe('MarketplaceService', () => {
  let marketplaceService: MarketplaceService;
  let mockLogger: jest.Mocked<Logger>;
  let mockBlockchainService: jest.Mocked<BlockchainService>;
  let mockConsentService: jest.Mocked<ConsentService>;

  // Test data
  const mockDataRequest: DataRequest = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    companyId: '123e4567-e89b-12d3-a456-426614174001',
    title: 'Test Request',
    description: 'Test Description',
    filterCriteria: {
      resourceTypes: ['Patient', 'Observation'],
      demographics: {
        ageRange: { min: 18, max: 65 },
        gender: ['M', 'F'],
        ethnicity: ['caucasian'],
        location: ['US'],
        populationGroup: ['general']
      },
      conditions: ['diabetes'],
      dateRange: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      },
      excludedFields: ['ssn'],
      complianceLevel: ComplianceLevel.HIPAA
    },
    pricePerRecord: 1.0,
    recordsNeeded: 100,
    status: RequestStatus.DRAFT,
    complianceStatus: 'COMPLIANT',
    blockchainRef: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date('2024-12-31'),
    auditTrail: []
  };

  beforeEach(() => {
    // Reset mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockBlockchainService = {
      submitTransaction: jest.fn(),
      verifyTransaction: jest.fn()
    } as unknown as jest.Mocked<BlockchainService>;

    mockConsentService = {
      verifyUserConsentsWithBlockchain: jest.fn()
    } as unknown as jest.Mocked<ConsentService>;

    // Initialize service
    marketplaceService = new MarketplaceService(
      mockLogger,
      mockConsentService,
      mockBlockchainService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDataRequest', () => {
    test('should create HIPAA-compliant data request with blockchain integration', async () => {
      // Mock validation result
      const mockValidationResult: FHIRValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        stats: {
          totalFields: 10,
          validFields: 10,
          errorCount: 0,
          warningCount: 0,
          successRate: 1.0
        }
      };

      jest.spyOn(ValidationUtil, 'validateFHIRResource')
        .mockResolvedValue(mockValidationResult);

      mockBlockchainService.submitTransaction.mockResolvedValue({
        transactionId: 'tx123',
        success: true
      });

      // Execute test
      const result = await marketplaceService.createDataRequest(mockDataRequest);

      // Verify HIPAA compliance validation
      expect(ValidationUtil.validateFHIRResource).toHaveBeenCalledWith(
        mockDataRequest.filterCriteria,
        { validateHIPAA: true }
      );

      // Verify blockchain transaction
      expect(mockBlockchainService.submitTransaction).toHaveBeenCalledWith(
        'CreateRequest',
        expect.any(String)
      );

      // Verify result
      expect(result).toEqual(expect.objectContaining({
        id: mockDataRequest.id,
        status: RequestStatus.DRAFT,
        complianceStatus: 'COMPLIANT'
      }));

      // Verify audit logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Data request created successfully',
        expect.any(Object)
      );
    });

    test('should reject request with insufficient HIPAA compliance', async () => {
      // Mock failed validation
      const mockValidationResult: FHIRValidationResult = {
        valid: false,
        errors: [{
          type: 'Required',
          path: 'filterCriteria.complianceLevel',
          message: 'HIPAA compliance level required'
        }],
        warnings: [],
        stats: {
          totalFields: 10,
          validFields: 9,
          errorCount: 1,
          warningCount: 0,
          successRate: 0.9
        }
      };

      jest.spyOn(ValidationUtil, 'validateFHIRResource')
        .mockResolvedValue(mockValidationResult);

      // Execute and verify rejection
      await expect(marketplaceService.createDataRequest(mockDataRequest))
        .rejects.toThrow('FHIR validation failed: HIPAA compliance level required');
    });
  });

  describe('findMatchingRecords', () => {
    const mockMatches: DataMatch[] = [{
      id: '123',
      requestId: mockDataRequest.id,
      resourceId: 'resource123',
      score: 0.95,
      matchedCriteria: ['age', 'gender'],
      complianceVerification: true,
      consentStatus: 'VALID',
      status: MatchStatus.PENDING,
      blockchainRef: 'block123',
      createdAt: new Date(),
      updatedAt: new Date(),
      auditTrail: []
    }];

    test('should find matches with consent verification and blockchain tracking', async () => {
      // Mock consent verification
      mockConsentService.verifyUserConsentsWithBlockchain
        .mockResolvedValue(true);

      // Mock blockchain transaction
      mockBlockchainService.submitTransaction.mockResolvedValue({
        transactionId: 'tx123',
        success: true
      });

      // Execute test
      const result = await marketplaceService.findMatchingRecords(mockDataRequest.id);

      // Verify consent verification
      expect(mockConsentService.verifyUserConsentsWithBlockchain)
        .toHaveBeenCalled();

      // Verify blockchain recording
      expect(mockBlockchainService.submitTransaction).toHaveBeenCalledWith(
        'RecordMatching',
        expect.any(String)
      );

      // Verify result
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          requestId: mockDataRequest.id,
          consentStatus: 'VALID'
        })
      ]));
    });

    test('should filter out matches with invalid consent', async () => {
      // Mock failed consent verification
      mockConsentService.verifyUserConsentsWithBlockchain
        .mockResolvedValue(false);

      // Execute test
      const result = await marketplaceService.findMatchingRecords(mockDataRequest.id);

      // Verify empty results
      expect(result).toHaveLength(0);
    });
  });

  describe('processTransaction', () => {
    const mockTransaction: MarketplaceTransaction = {
      id: 'tx123',
      requestId: mockDataRequest.id,
      providerId: 'provider123',
      companyId: mockDataRequest.companyId,
      resourceIds: ['resource123'],
      amount: 100.0,
      status: TransactionStatus.INITIATED,
      blockchainRef: '',
      complianceStatus: 'COMPLIANT',
      paymentDetails: {
        transactionId: 'pay123',
        amount: 100.0,
        currency: 'USD',
        status: 'COMPLETED',
        processorRef: 'ref123',
        timestamp: new Date()
      },
      createdAt: new Date(),
      completedAt: new Date(),
      auditTrail: []
    };

    test('should process transaction with blockchain verification', async () => {
      // Mock consent verification
      mockConsentService.verifyUserConsentsWithBlockchain
        .mockResolvedValue(true);

      // Mock blockchain transaction
      mockBlockchainService.submitTransaction.mockResolvedValue({
        transactionId: 'tx123',
        success: true
      });

      // Execute test
      const result = await marketplaceService.processTransaction(
        mockDataRequest.id,
        'provider123',
        ['resource123']
      );

      // Verify blockchain transaction
      expect(mockBlockchainService.submitTransaction).toHaveBeenCalledWith(
        'ProcessTransaction',
        expect.any(String)
      );

      // Verify result
      expect(result).toEqual(expect.objectContaining({
        status: TransactionStatus.COMPLETED,
        blockchainRef: expect.any(String)
      }));
    });

    test('should reject transaction with invalid consent', async () => {
      // Mock failed consent verification
      mockConsentService.verifyUserConsentsWithBlockchain
        .mockResolvedValue(false);

      // Execute and verify rejection
      await expect(marketplaceService.processTransaction(
        mockDataRequest.id,
        'provider123',
        ['resource123']
      )).rejects.toThrow('Invalid consent status');
    });
  });
});