import { MongoMemoryServer } from 'mongodb-memory-server';
import { CompanyService } from '../../src/services/company.service';
import CompanyModel from '../../src/models/company.model';
import { 
  ICompany, 
  CompanyType, 
  CompanyStatus, 
  VerificationStatus,
  CertificationType,
  PaymentMethod
} from '../../src/interfaces/company.interface';
import { Logger } from 'winston';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

// Test company data constants
const TEST_COMPANY_DATA: ICompany = {
  id: crypto.randomUUID(),
  name: 'Test Healthcare Corp',
  email: 'compliance@testhealthcare.com',
  type: CompanyType.HEALTHCARE_PROVIDER,
  status: CompanyStatus.INACTIVE,
  verificationStatus: VerificationStatus.PENDING,
  profile: {
    description: 'Test healthcare provider organization',
    website: 'https://testhealthcare.com',
    address: {
      street: '123 Health St',
      city: 'Medtown',
      state: 'MT',
      country: 'USA',
      postalCode: '12345'
    },
    phone: '+1-555-123-4567',
    researchAreas: ['Clinical Trials', 'Patient Data Analysis'],
    certifications: [{
      type: CertificationType.HIPAA,
      number: 'HIPAA-123456',
      issuedAt: new Date('2023-01-01'),
      expiresAt: new Date('2024-01-01'),
      verificationDocument: 'hipaa-cert.pdf'
    }],
    complianceOfficer: 'John Smith',
    complianceEmail: 'john.smith@testhealthcare.com'
  },
  billingInfo: {
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    billingAddress: {
      street: '123 Health St',
      city: 'Medtown',
      state: 'MT',
      country: 'USA',
      postalCode: '12345'
    },
    taxId: '12-3456789',
    billingEmail: 'billing@testhealthcare.com',
    billingContact: 'Jane Doe'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  lastVerifiedAt: null
};

describe('Company Service Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let companyService: CompanyService;
  let mockLogger: Logger;
  let mockCache: Cache;

  beforeAll(async () => {
    // Initialize MongoDB Memory Server with HIPAA-compliant configuration
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-db',
        storageEngine: 'wiredTiger',
        auth: true
      }
    });

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as Logger;

    // Mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn()
    } as unknown as Cache;

    // Initialize company service with test configuration
    companyService = new CompanyService(
      CompanyModel,
      mockLogger,
      mockCache
    );
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await CompanyModel.deleteMany({});
    jest.clearAllMocks();
  });

  describe('Company Creation', () => {
    it('should create a new company with proper encryption and audit trail', async () => {
      // Create company
      const createdCompany = await companyService.createCompany(TEST_COMPANY_DATA);

      // Verify company creation
      expect(createdCompany).toBeDefined();
      expect(createdCompany.id).toBeDefined();
      expect(createdCompany.status).toBe(CompanyStatus.INACTIVE);
      expect(createdCompany.verificationStatus).toBe(VerificationStatus.PENDING);

      // Verify sensitive data encryption
      const dbCompany = await CompanyModel.findById(createdCompany.id);
      expect(dbCompany.email).not.toBe(TEST_COMPANY_DATA.email);
      expect(dbCompany.profile.complianceEmail).not.toBe(TEST_COMPANY_DATA.profile.complianceEmail);
      expect(dbCompany.billingInfo.taxId).not.toBe(TEST_COMPANY_DATA.billingInfo.taxId);

      // Verify audit logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Company created',
        expect.objectContaining({
          companyId: createdCompany.id,
          type: CompanyType.HEALTHCARE_PROVIDER
        })
      );
    });

    it('should reject company creation with invalid HIPAA certification', async () => {
      const invalidCompany = {
        ...TEST_COMPANY_DATA,
        profile: {
          ...TEST_COMPANY_DATA.profile,
          certifications: []
        }
      };

      await expect(companyService.createCompany(invalidCompany))
        .rejects
        .toThrow('Missing required healthcare certifications');
    });
  });

  describe('Company Verification', () => {
    it('should verify company with proper security controls', async () => {
      // Create initial company
      const company = await companyService.createCompany(TEST_COMPANY_DATA);

      // Update verification status
      const verifiedCompany = await companyService.updateCompany(company.id, {
        verificationStatus: VerificationStatus.VERIFIED,
        lastVerifiedAt: new Date()
      });

      // Verify status update
      expect(verifiedCompany.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(verifiedCompany.lastVerifiedAt).toBeDefined();

      // Verify audit trail
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Company updated',
        expect.objectContaining({
          companyId: company.id,
          updatedFields: expect.arrayContaining(['verificationStatus', 'lastVerifiedAt'])
        })
      );
    });
  });

  describe('Company Update', () => {
    it('should update company profile maintaining security controls', async () => {
      // Create initial company
      const company = await companyService.createCompany(TEST_COMPANY_DATA);

      // Update company data
      const updateData = {
        profile: {
          ...TEST_COMPANY_DATA.profile,
          complianceOfficer: 'Jane Smith',
          complianceEmail: 'jane.smith@testhealthcare.com'
        }
      };

      const updatedCompany = await companyService.updateCompany(company.id, updateData);

      // Verify updates
      expect(updatedCompany.profile.complianceOfficer).toBe('Jane Smith');
      expect(updatedCompany.profile.complianceEmail).not.toBe(updateData.profile.complianceEmail);

      // Verify cache update
      expect(mockCache.set).toHaveBeenCalledWith(
        `company:${company.id}`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should maintain field-level encryption during updates', async () => {
      const company = await companyService.createCompany(TEST_COMPANY_DATA);
      
      const updateData = {
        email: 'newemail@testhealthcare.com',
        billingInfo: {
          ...TEST_COMPANY_DATA.billingInfo,
          taxId: '98-7654321'
        }
      };

      const updatedCompany = await companyService.updateCompany(company.id, updateData);
      const dbCompany = await CompanyModel.findById(company.id);

      expect(dbCompany.email).not.toBe(updateData.email);
      expect(dbCompany.billingInfo.taxId).not.toBe(updateData.billingInfo.taxId);
    });
  });

  describe('Company Retrieval', () => {
    it('should retrieve company data with proper decryption', async () => {
      // Create test company
      const company = await companyService.createCompany(TEST_COMPANY_DATA);

      // Mock cache miss for first retrieval
      mockCache.get.mockResolvedValueOnce(null);

      // Retrieve company
      const retrievedCompany = await companyService.getCompanyById(company.id);

      // Verify data retrieval and decryption
      expect(retrievedCompany.email).toBe(TEST_COMPANY_DATA.email);
      expect(retrievedCompany.profile.complianceEmail).toBe(TEST_COMPANY_DATA.profile.complianceEmail);
      expect(retrievedCompany.billingInfo.taxId).toBe(TEST_COMPANY_DATA.billingInfo.taxId);

      // Verify caching
      expect(mockCache.set).toHaveBeenCalledWith(
        `company:${company.id}`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return cached company data when available', async () => {
      const company = await companyService.createCompany(TEST_COMPANY_DATA);
      
      // Mock cache hit
      mockCache.get.mockResolvedValueOnce(company);

      const retrievedCompany = await companyService.getCompanyById(company.id);

      expect(mockCache.get).toHaveBeenCalledWith(`company:${company.id}`);
      expect(retrievedCompany).toEqual(company);
    });
  });
});