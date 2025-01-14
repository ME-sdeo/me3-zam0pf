/**
 * Unit tests for ConsentService with HIPAA compliance and blockchain integration
 * @version 1.0.0
 */

import { ConsentService } from '../../src/services/consent.service';
import { IConsent, ConsentStatus } from '../../src/interfaces/consent.interface';
import { Logger } from 'winston';
import { FabricService } from '../../src/blockchain/services/fabric.service';
import { RedisCache } from '../../src/utils/cache.util';
import { MetricsCollector } from '../../src/utils/metrics.util';
import { validateFHIRResource } from '../../src/utils/validation.util';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('winston');
jest.mock('../../src/blockchain/services/fabric.service');
jest.mock('../../src/utils/cache.util');
jest.mock('../../src/utils/metrics.util');
jest.mock('../../src/utils/validation.util');

describe('ConsentService', () => {
  let consentService: ConsentService;
  let mockLogger: jest.Mocked<Logger>;
  let mockFabricService: jest.Mocked<FabricService>;
  let mockCache: jest.Mocked<RedisCache>;
  let mockMetrics: jest.Mocked<MetricsCollector>;

  const mockConsent: Omit<IConsent, 'id'> = {
    userId: uuidv4(),
    companyId: uuidv4(),
    requestId: uuidv4(),
    permissions: {
      resourceTypes: ['Patient', 'Observation'],
      accessLevel: 'READ',
      dataElements: ['demographics', 'vitals'],
      purpose: 'Research study XYZ-123',
      constraints: {
        timeRestrictions: [{
          startTime: '08:00',
          endTime: '17:00'
        }],
        ipRestrictions: ['192.168.1.0/24'],
        usageLimit: 100
      }
    },
    validFrom: new Date(),
    validTo: new Date(Date.now() + 86400000), // 24 hours later
    blockchainRef: '0x' + '0'.repeat(64),
    status: ConsentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      hipaaCompliant: true,
      gdprCompliant: true
    }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockFabricService = {
      submitConsent: jest.fn(),
      verifyConsentChain: jest.fn(),
      updateConsentStatus: jest.fn()
    } as unknown as jest.Mocked<FabricService>;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as unknown as jest.Mocked<RedisCache>;

    mockMetrics = {
      incrementCounter: jest.fn(),
      recordTiming: jest.fn()
    } as unknown as jest.Mocked<MetricsCollector>;

    // Initialize service
    consentService = new ConsentService(
      mockLogger,
      mockFabricService,
      mockCache,
      mockMetrics
    );
  });

  describe('createConsent', () => {
    it('should create a HIPAA-compliant consent record with blockchain verification', async () => {
      // Mock validation success
      (validateFHIRResource as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        stats: { successRate: 1 }
      });

      // Mock blockchain submission success
      mockFabricService.submitConsent.mockResolvedValue({
        id: '0x' + '1'.repeat(64),
        txHash: '0x' + 'a'.repeat(64)
      });
      mockFabricService.verifyConsentChain.mockResolvedValue(true);

      // Execute test
      const result = await consentService.createConsent(mockConsent);

      // Verify HIPAA compliance validation
      expect(validateFHIRResource).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockConsent,
          id: expect.any(String)
        })
      );

      // Verify blockchain submission
      expect(mockFabricService.submitConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          patientId: mockConsent.userId,
          providerId: mockConsent.companyId
        })
      );

      // Verify blockchain verification
      expect(mockFabricService.verifyConsentChain).toHaveBeenCalled();

      // Verify cache update
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('consent:'),
        expect.any(String),
        expect.any(Number)
      );

      // Verify metrics
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('consent.created');

      // Verify result
      expect(result).toEqual(expect.objectContaining({
        ...mockConsent,
        id: expect.any(String)
      }));
    });

    it('should handle HIPAA compliance validation failure', async () => {
      // Mock validation failure
      (validateFHIRResource as jest.Mock).mockResolvedValue({
        valid: false,
        errors: [{
          type: 'Required',
          path: 'meta.security',
          message: 'HIPAA compliance requires security tags'
        }]
      });

      // Execute and verify error handling
      await expect(consentService.createConsent(mockConsent))
        .rejects.toThrow('Consent validation failed');

      // Verify no blockchain submission occurred
      expect(mockFabricService.submitConsent).not.toHaveBeenCalled();
    });

    it('should handle blockchain submission failure', async () => {
      // Mock validation success
      (validateFHIRResource as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        stats: { successRate: 1 }
      });

      // Mock blockchain failure
      mockFabricService.submitConsent.mockRejectedValue(
        new Error('Blockchain submission failed')
      );

      // Execute and verify error handling
      await expect(consentService.createConsent(mockConsent))
        .rejects.toThrow('Blockchain submission failed');

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create consent record',
        expect.any(Object)
      );
    });
  });

  describe('updateConsentStatus', () => {
    const consentId = uuidv4();
    const newStatus = ConsentStatus.ACTIVE;

    it('should update consent status with blockchain synchronization', async () => {
      // Mock blockchain update success
      mockFabricService.updateConsentStatus.mockResolvedValue({
        id: '0x' + '1'.repeat(64),
        txHash: '0x' + 'a'.repeat(64)
      });
      mockFabricService.verifyConsentChain.mockResolvedValue(true);

      // Execute test
      const result = await consentService.updateConsentStatus(consentId, newStatus);

      // Verify blockchain update
      expect(mockFabricService.updateConsentStatus).toHaveBeenCalledWith(
        consentId,
        newStatus
      );

      // Verify blockchain verification
      expect(mockFabricService.verifyConsentChain).toHaveBeenCalled();

      // Verify cache invalidation
      expect(mockCache.del).toHaveBeenCalledWith(`consent:${consentId}`);

      // Verify metrics
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('consent.updated');

      // Verify result
      expect(result).toBeDefined();
      expect(result.status).toBe(newStatus);
    });

    it('should handle invalid status transitions', async () => {
      // Mock invalid transition
      const invalidStatus = ConsentStatus.EXPIRED;

      // Execute and verify error handling
      await expect(consentService.updateConsentStatus(consentId, invalidStatus))
        .rejects.toThrow('Invalid consent status transition');

      // Verify no blockchain update occurred
      expect(mockFabricService.updateConsentStatus).not.toHaveBeenCalled();
    });
  });

  describe('getUserConsents', () => {
    const userId = uuidv4();
    const options = { page: 1, limit: 10 };

    it('should retrieve paginated user consents with blockchain verification', async () => {
      // Mock cache miss
      mockCache.get.mockResolvedValue(null);

      // Mock blockchain verification
      mockFabricService.verifyConsentChain.mockResolvedValue(true);

      // Execute test
      const result = await consentService.getUserConsents(userId, options);

      // Verify cache check
      expect(mockCache.get).toHaveBeenCalledWith(
        `user-consents:${userId}:${options.page}:${options.limit}`
      );

      // Verify blockchain verification
      expect(mockFabricService.verifyConsentChain).toHaveBeenCalled();

      // Verify metrics
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('consent.retrieved');

      // Verify result structure
      expect(result).toHaveProperty('consents');
      expect(result).toHaveProperty('total');
    });

    it('should return cached results when available', async () => {
      // Mock cache hit
      const cachedResult = {
        consents: [mockConsent],
        total: 1
      };
      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Execute test
      const result = await consentService.getUserConsents(userId, options);

      // Verify cache hit
      expect(mockCache.get).toHaveBeenCalled();
      expect(result).toEqual(cachedResult);

      // Verify no blockchain verification needed
      expect(mockFabricService.verifyConsentChain).not.toHaveBeenCalled();
    });
  });
});