/**
 * Integration tests for MyElixir's HIPAA-compliant consent management system
 * @version 1.0.0
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'jest';
import { expect } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { ConsentService } from '../../src/services/consent.service';
import { IConsent, ConsentStatus, ConsentAccessLevel } from '../../src/interfaces/consent.interface';
import { FabricService } from '../../src/blockchain/services/fabric.service';
import { validateFHIRResource } from '../../src/utils/validation.util';
import { v4 as uuidv4 } from 'uuid';

describe('Consent Management Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let consentService: ConsentService;
  let mockFabricService: jest.Mocked<FabricService>;
  let testConsent: IConsent;

  beforeAll(async () => {
    // Initialize MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    // Mock Fabric Service
    mockFabricService = {
      submitConsent: jest.fn().mockResolvedValue({ id: 'mock-blockchain-id' }),
      updateConsentStatus: jest.fn().mockResolvedValue(true),
      verifyConsentChain: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<FabricService>;

    // Initialize Consent Service with mocked dependencies
    consentService = new ConsentService(
      console as any, // Mock logger
      mockFabricService,
      {} as any, // Mock cache
      {} as any  // Mock metrics
    );
  });

  beforeEach(() => {
    // Initialize test consent data
    testConsent = {
      id: uuidv4(),
      userId: uuidv4(),
      companyId: uuidv4(),
      requestId: uuidv4(),
      permissions: {
        resourceTypes: ['Patient', 'Observation'],
        accessLevel: ConsentAccessLevel.READ,
        dataElements: ['demographics', 'vitals'],
        purpose: 'Clinical Research',
        constraints: {
          timeRestrictions: [{
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 86400000).toISOString()
          }],
          ipRestrictions: ['192.168.1.0/24'],
          usageLimit: 100
        }
      },
      validFrom: new Date(),
      validTo: new Date(Date.now() + 86400000),
      blockchainRef: '0x' + '0'.repeat(64),
      status: ConsentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        hipaaCompliant: true,
        gdprCompliant: true
      }
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  describe('Consent Creation', () => {
    it('should create a HIPAA-compliant consent record with blockchain verification', async () => {
      // Arrange
      const { id, ...consentData } = testConsent;

      // Act
      const createdConsent = await consentService.createConsent(consentData);

      // Assert
      expect(createdConsent).toBeDefined();
      expect(createdConsent.id).toBeDefined();
      expect(mockFabricService.submitConsent).toHaveBeenCalledTimes(1);
      expect(mockFabricService.verifyConsentChain).toHaveBeenCalledTimes(1);
    });

    it('should validate HIPAA compliance before creating consent', async () => {
      // Arrange
      const { id, ...consentData } = testConsent;
      const validationResult = await validateFHIRResource(consentData as any);

      // Assert
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should reject consent creation with invalid HIPAA compliance', async () => {
      // Arrange
      const { id, ...consentData } = testConsent;
      consentData.metadata.hipaaCompliant = false;

      // Act & Assert
      await expect(consentService.createConsent(consentData))
        .rejects
        .toThrow('Consent does not meet compliance requirements');
    });
  });

  describe('Consent Status Management', () => {
    it('should update consent status with blockchain synchronization', async () => {
      // Arrange
      const createdConsent = await consentService.createConsent(
        { ...testConsent, id: undefined }
      );

      // Act
      const updatedConsent = await consentService.updateConsentStatus(
        createdConsent.id,
        ConsentStatus.ACTIVE
      );

      // Assert
      expect(updatedConsent.status).toBe(ConsentStatus.ACTIVE);
      expect(mockFabricService.updateConsentStatus).toHaveBeenCalledWith(
        createdConsent.id,
        ConsentStatus.ACTIVE
      );
    });

    it('should validate consent status transitions', async () => {
      // Arrange
      const createdConsent = await consentService.createConsent(
        { ...testConsent, id: undefined }
      );

      // Act & Assert
      await expect(consentService.updateConsentStatus(
        createdConsent.id,
        ConsentStatus.EXPIRED
      )).rejects.toThrow('Invalid consent status transition');
    });

    it('should maintain audit trail for status changes', async () => {
      // Arrange
      const createdConsent = await consentService.createConsent(
        { ...testConsent, id: undefined }
      );

      // Act
      const updatedConsent = await consentService.updateConsentStatus(
        createdConsent.id,
        ConsentStatus.ACTIVE
      );

      // Assert
      expect(updatedConsent.auditLog).toBeDefined();
      expect(updatedConsent.auditLog.length).toBeGreaterThan(0);
      expect(updatedConsent.auditLog[updatedConsent.auditLog.length - 1].action)
        .toContain('Status updated to ACTIVE');
    });
  });

  describe('Consent Retrieval', () => {
    it('should retrieve user consents with blockchain verification', async () => {
      // Arrange
      await consentService.createConsent({ ...testConsent, id: undefined });

      // Act
      const result = await consentService.getUserConsents(testConsent.userId, {
        page: 1,
        limit: 10
      });

      // Assert
      expect(result.consents).toBeDefined();
      expect(result.consents.length).toBeGreaterThan(0);
      expect(mockFabricService.verifyConsentChain).toHaveBeenCalled();
    });

    it('should handle pagination for consent retrieval', async () => {
      // Arrange
      const consents = await Promise.all([
        consentService.createConsent({ ...testConsent, id: undefined }),
        consentService.createConsent({ ...testConsent, id: undefined }),
        consentService.createConsent({ ...testConsent, id: undefined })
      ]);

      // Act
      const result = await consentService.getUserConsents(testConsent.userId, {
        page: 1,
        limit: 2
      });

      // Assert
      expect(result.consents).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle blockchain submission failures', async () => {
      // Arrange
      mockFabricService.submitConsent.mockRejectedValueOnce(new Error('Blockchain error'));

      // Act & Assert
      await expect(consentService.createConsent({ ...testConsent, id: undefined }))
        .rejects
        .toThrow('Blockchain error');
    });

    it('should handle database transaction failures', async () => {
      // Arrange
      const dbError = new Error('Database error');
      jest.spyOn(consentService as any, 'validateConsentStatus')
        .mockRejectedValueOnce(dbError);

      // Act & Assert
      await expect(consentService.updateConsentStatus(
        testConsent.id,
        ConsentStatus.ACTIVE
      )).rejects.toThrow('Database error');
    });
  });
});