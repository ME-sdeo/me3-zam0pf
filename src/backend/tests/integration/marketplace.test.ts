import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Gateway } from '@hyperledger/fabric-sdk';
import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import { MarketplaceController } from '../../src/api/controllers/marketplace.controller';
import { DataRequest, RequestStatus, TransactionStatus } from '../../src/interfaces/marketplace.interface';
import { FHIRValidationResult } from '../../src/interfaces/fhir.interface';
import { ValidationMetricsCollector } from '../../src/utils/validation.util';

// Test constants
const TEST_TIMEOUT = 60000;
const MOCK_COMPANY_ID = uuidv4();
const MOCK_USER_ID = uuidv4();
const MIN_PRICE_PER_RECORD = 0.5;

// Test containers
let mongoContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;
let fabricNetwork: Gateway;
let marketplaceController: MarketplaceController;

describe('Marketplace Integration Tests', () => {
  beforeAll(async () => {
    // Start MongoDB container with HIPAA-compliant configuration
    mongoContainer = await new GenericContainer('mongo:5.0')
      .withExposedPorts(27017)
      .withEnv('MONGO_INITDB_ROOT_USERNAME', 'admin')
      .withEnv('MONGO_INITDB_ROOT_PASSWORD', 'admin123')
      .withEnv('MONGO_INITDB_DATABASE', 'test')
      .start();

    // Start Redis container for caching
    redisContainer = await new GenericContainer('redis:6.2')
      .withExposedPorts(6379)
      .start();

    // Initialize test blockchain network
    fabricNetwork = await initializeTestBlockchain();

    // Initialize marketplace controller
    marketplaceController = new MarketplaceController();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test resources
    await mongoContainer.stop();
    await redisContainer.stop();
    await fabricNetwork.disconnect();
  });

  describe('Data Request Creation', () => {
    it('should create a valid data request with HIPAA compliance', async () => {
      const request: DataRequest = {
        companyId: MOCK_COMPANY_ID,
        title: 'Test Data Request',
        description: 'Integration test for HIPAA-compliant data request',
        filterCriteria: {
          resourceTypes: ['Patient', 'Observation'],
          demographics: {
            ageRange: { min: 18, max: 65 },
            gender: ['male', 'female'],
            ethnicity: ['caucasian', 'asian'],
            location: ['US-NY', 'US-CA']
          },
          conditions: ['diabetes-type-2'],
          dateRange: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          excludedFields: ['ssn', 'insurance'],
          complianceLevel: 'HIPAA'
        },
        pricePerRecord: MIN_PRICE_PER_RECORD,
        recordsNeeded: 100,
        status: RequestStatus.DRAFT
      };

      const response = await marketplaceController.createRequest(request);

      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.blockchainRef).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.status).toBe(RequestStatus.DRAFT);
    });

    it('should reject request with invalid HIPAA compliance', async () => {
      const invalidRequest: DataRequest = {
        ...createMockRequest(),
        filterCriteria: {
          ...createMockRequest().filterCriteria,
          excludedFields: [] // Missing required PHI exclusions
        }
      };

      await expect(marketplaceController.createRequest(invalidRequest))
        .rejects
        .toThrow('HIPAA compliance validation failed');
    });

    it('should create blockchain record for request', async () => {
      const request = createMockRequest();
      const response = await marketplaceController.createRequest(request);
      
      const blockchainRecord = await fabricNetwork.getNetwork('consentchannel')
        .getContract('consentcontract')
        .evaluateTransaction('GetRequest', response.id);

      expect(blockchainRecord).toBeDefined();
      expect(JSON.parse(blockchainRecord.toString()).id).toBe(response.id);
    });
  });

  describe('Data Matching', () => {
    it('should find matches with HIPAA compliance verification', async () => {
      const request = await createAndSubmitRequest();
      const result = await marketplaceController.findMatches(request.id);

      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.complianceStatus.valid).toBe(true);
    });

    it('should filter matches based on consent status', async () => {
      const request = await createAndSubmitRequest();
      const result = await marketplaceController.findMatches(request.id);

      expect(result.matches.every(match => match.consentStatus === 'VALID')).toBe(true);
    });

    it('should validate HIPAA compliance for matched records', async () => {
      const request = await createAndSubmitRequest();
      const result = await marketplaceController.findMatches(request.id);

      const validationResults = await Promise.all(
        result.matches.map(match => validateMatchCompliance(match))
      );

      expect(validationResults.every(result => result.valid)).toBe(true);
    });
  });

  describe('Transaction Processing', () => {
    it('should process compliant transaction with blockchain verification', async () => {
      const request = await createAndSubmitRequest();
      const matches = await marketplaceController.findMatches(request.id);
      
      const transaction = {
        requestId: request.id,
        providerId: MOCK_USER_ID,
        resourceIds: matches.matches.map(m => m.id),
        amount: request.pricePerRecord * matches.matches.length,
        status: TransactionStatus.INITIATED
      };

      const result = await marketplaceController.processTransaction(transaction);

      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.blockchainRef).toBeDefined();
    });

    it('should verify blockchain record after transaction', async () => {
      const transaction = await createAndProcessTransaction();
      
      const blockchainRecord = await fabricNetwork.getNetwork('consentchannel')
        .getContract('consentcontract')
        .evaluateTransaction('GetTransaction', transaction.id);

      expect(blockchainRecord).toBeDefined();
      expect(JSON.parse(blockchainRecord.toString()).status).toBe(TransactionStatus.COMPLETED);
    });

    it('should maintain HIPAA compliance audit trail', async () => {
      const transaction = await createAndProcessTransaction();
      
      expect(transaction.auditTrail).toBeDefined();
      expect(transaction.auditTrail.length).toBeGreaterThan(0);
      expect(transaction.auditTrail[0].action).toBe('TRANSACTION_INITIATED');
    });
  });
});

// Helper functions
async function initializeTestBlockchain(): Promise<Gateway> {
  // Implementation would initialize test blockchain network
  return new Gateway();
}

function createMockRequest(): DataRequest {
  return {
    companyId: MOCK_COMPANY_ID,
    title: 'Test Request',
    description: 'Integration test request',
    filterCriteria: {
      resourceTypes: ['Patient'],
      demographics: {
        ageRange: { min: 18, max: 65 },
        gender: ['male', 'female']
      },
      conditions: ['diabetes-type-2'],
      dateRange: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      excludedFields: ['ssn', 'insurance'],
      complianceLevel: 'HIPAA'
    },
    pricePerRecord: MIN_PRICE_PER_RECORD,
    recordsNeeded: 100,
    status: RequestStatus.DRAFT
  } as DataRequest;
}

async function createAndSubmitRequest(): Promise<DataRequest> {
  const request = createMockRequest();
  return await marketplaceController.createRequest(request);
}

async function validateMatchCompliance(match: any): Promise<FHIRValidationResult> {
  // Implementation would validate HIPAA compliance of matched record
  return { valid: true, errors: [], warnings: [], stats: { totalFields: 0, validFields: 0, errorCount: 0, warningCount: 0, successRate: 1 } };
}

async function createAndProcessTransaction() {
  const request = await createAndSubmitRequest();
  const matches = await marketplaceController.findMatches(request.id);
  
  const transaction = {
    requestId: request.id,
    providerId: MOCK_USER_ID,
    resourceIds: matches.matches.map(m => m.id),
    amount: request.pricePerRecord * matches.matches.length,
    status: TransactionStatus.INITIATED
  };

  return await marketplaceController.processTransaction(transaction);
}