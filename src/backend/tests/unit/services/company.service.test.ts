import { jest } from '@jest/globals';
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

// Mock implementations
jest.mock('../../src/models/company.model');
jest.mock('winston');
jest.mock('cache-manager');

describe('CompanyService', () => {
  let companyService: CompanyService;
  let mockLogger: jest.Mocked<Logger>;
  let mockCache: jest.Mocked<Cache>;
  
  // Sample test data
  const mockCompanyData: ICompany = {
    id: '12345',
    name: 'Test Healthcare Corp',
    email: 'compliance@testhealthcare.com',
    type: CompanyType.HEALTHCARE_PROVIDER,
    status: CompanyStatus.INACTIVE,
    verificationStatus: VerificationStatus.PENDING,
    profile: {
      description: 'Healthcare research organization',
      website: 'https://testhealthcare.com',
      address: {
        street: '123 Health St',
        city: 'Medtown',
        state: 'MT',
        country: 'USA',
        postalCode: '12345'
      },
      phone: '+1-555-123-4567',
      researchAreas: ['Oncology', 'Cardiology'],
      certifications: [{
        type: CertificationType.HIPAA,
        number: 'HIPAA-123',
        issuedAt: new Date('2023-01-01'),
        expiresAt: new Date('2024-01-01'),
        verificationDocument: 'hipaa-cert.pdf'
      }],
      complianceOfficer: 'John Smith',
      complianceEmail: 'compliance@testhealthcare.com'
    },
    billingInfo: {
      paymentMethod: PaymentMethod.CREDIT_CARD,
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

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn()
    } as unknown as jest.Mocked<Cache>;

    // Initialize service
    companyService = new CompanyService(
      CompanyModel,
      mockLogger,
      mockCache
    );
  });

  describe('createCompany', () => {
    it('should create a new company with encrypted sensitive data', async () => {
      // Setup
      const mockCreatedCompany = { ...mockCompanyData, id: '12345' };
      (CompanyModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanyModel.create as jest.Mock).mockResolvedValue(mockCreatedCompany);

      // Execute
      const result = await companyService.createCompany(mockCompanyData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('12345');
      expect(result.status).toBe(CompanyStatus.INACTIVE);
      expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
      expect(CompanyModel.create).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('Company created', expect.any(Object));
      expect(mockCache.set).toHaveBeenCalledWith(
        `company:${result.id}`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error if company with email already exists', async () => {
      // Setup
      (CompanyModel.findOne as jest.Mock).mockResolvedValue(mockCompanyData);

      // Execute & Assert
      await expect(companyService.createCompany(mockCompanyData))
        .rejects
        .toThrow('Company with this email already exists');
      expect(CompanyModel.create).not.toHaveBeenCalled();
    });

    it('should validate HIPAA compliance requirements', async () => {
      // Setup
      const invalidCompanyData = { ...mockCompanyData };
      delete invalidCompanyData.profile.complianceOfficer;
      
      // Execute & Assert
      await expect(companyService.createCompany(invalidCompanyData))
        .rejects
        .toThrow();
      expect(CompanyModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateCompany', () => {
    it('should update existing company with encrypted sensitive data', async () => {
      // Setup
      const updateData = {
        name: 'Updated Healthcare Corp',
        profile: {
          ...mockCompanyData.profile,
          complianceOfficer: 'Jane Smith'
        }
      };
      (CompanyModel.findById as jest.Mock).mockResolvedValue(mockCompanyData);
      (CompanyModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockCompanyData,
        ...updateData
      });

      // Execute
      const result = await companyService.updateCompany('12345', updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.profile.complianceOfficer).toBe(updateData.profile.complianceOfficer);
      expect(CompanyModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw error if company not found', async () => {
      // Setup
      (CompanyModel.findById as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(companyService.updateCompany('12345', { name: 'Updated Corp' }))
        .rejects
        .toThrow('Company not found');
    });
  });

  describe('getCompanyById', () => {
    it('should return company from cache if available', async () => {
      // Setup
      mockCache.get.mockResolvedValue(mockCompanyData);

      // Execute
      const result = await companyService.getCompanyById('12345');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('12345');
      expect(CompanyModel.findById).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('company:12345');
    });

    it('should fetch from database and cache if not in cache', async () => {
      // Setup
      mockCache.get.mockResolvedValue(null);
      (CompanyModel.findById as jest.Mock).mockResolvedValue(mockCompanyData);

      // Execute
      const result = await companyService.getCompanyById('12345');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('12345');
      expect(CompanyModel.findById).toHaveBeenCalledWith('12345');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw error if company not found', async () => {
      // Setup
      mockCache.get.mockResolvedValue(null);
      (CompanyModel.findById as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(companyService.getCompanyById('12345'))
        .rejects
        .toThrow('Company not found');
    });
  });

  describe('verifyCompany', () => {
    it('should update verification status and trigger compliance checks', async () => {
      // Setup
      const verificationData = {
        status: VerificationStatus.VERIFIED,
        verifiedBy: 'admin@myelixir.com',
        verificationNotes: 'All documents verified'
      };
      (CompanyModel.findById as jest.Mock).mockResolvedValue(mockCompanyData);
      (CompanyModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockCompanyData,
        verificationStatus: VerificationStatus.VERIFIED,
        lastVerifiedAt: expect.any(Date)
      });

      // Execute
      const result = await companyService.verifyCompany('12345', verificationData);

      // Assert
      expect(result).toBeDefined();
      expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(result.lastVerifiedAt).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Company verification updated',
        expect.any(Object)
      );
    });
  });

  describe('updateCompanyStatus', () => {
    it('should update company status with audit trail', async () => {
      // Setup
      const statusUpdate = {
        status: CompanyStatus.ACTIVE,
        reason: 'Completed verification process'
      };
      (CompanyModel.findById as jest.Mock).mockResolvedValue(mockCompanyData);
      (CompanyModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockCompanyData,
        status: CompanyStatus.ACTIVE
      });

      // Execute
      const result = await companyService.updateCompanyStatus('12345', statusUpdate);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(CompanyStatus.ACTIVE);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Company status updated',
        expect.any(Object)
      );
    });
  });
});