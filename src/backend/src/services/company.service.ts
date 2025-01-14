import { Injectable } from '@nestjs/common';
import { AuditLog } from '../decorators/audit.decorator';
import { Logger } from 'winston';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto'; // v1.0.0
import CompanyModel from '../models/company.model';
import { 
  ICompany, 
  CompanyType, 
  CompanyStatus, 
  VerificationStatus,
  ICompanyProfile,
  ICompanyBilling
} from '../interfaces/company.interface';
import { validateCompanyData } from '../utils/validation.util';

// Cache TTL for company data (30 minutes)
const COMPANY_CACHE_TTL = 1800;

// Fields requiring encryption for HIPAA compliance
const SENSITIVE_FIELDS = [
  'email',
  'phone',
  'taxId',
  'profile.complianceEmail',
  'billingInfo.billingEmail'
];

/**
 * Service handling healthcare company management with HIPAA compliance
 * Implements secure company registration, verification, and profile management
 */
@Injectable()
@AuditLog()
export class CompanyService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly companyModel: typeof CompanyModel,
    private readonly logger: Logger,
    private readonly cacheManager: Cache
  ) {
    // Initialize encryption key from environment
    this.encryptionKey = Buffer.from(process.env.COMPANY_ENCRYPTION_KEY || '', 'hex');
  }

  /**
   * Creates a new healthcare company with HIPAA-compliant data handling
   * @param companyData Company registration data
   * @returns Created company profile
   */
  async createCompany(companyData: ICompany): Promise<ICompany> {
    try {
      // Validate company data against HIPAA requirements
      await validateCompanyData(companyData);

      // Check for existing company
      const existingCompany = await this.companyModel.findOne({ email: companyData.email });
      if (existingCompany) {
        throw new Error('Company with this email already exists');
      }

      // Encrypt sensitive fields
      const encryptedData = this.encryptSensitiveFields(companyData);

      // Set initial status and verification
      const company: ICompany = {
        ...encryptedData,
        status: CompanyStatus.INACTIVE,
        verificationStatus: VerificationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastVerifiedAt: null
      };

      // Create company record with audit trail
      const createdCompany = await this.companyModel.create(company);

      // Cache company data
      await this.cacheCompanyData(createdCompany.id, createdCompany);

      // Log company creation
      this.logger.info('Company created', {
        companyId: createdCompany.id,
        type: createdCompany.type,
        status: createdCompany.status
      });

      return this.maskSensitiveData(createdCompany);
    } catch (error) {
      this.logger.error('Company creation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Updates existing company profile with security controls
   * @param companyId Company identifier
   * @param updateData Updated company data
   * @returns Updated company profile
   */
  async updateCompany(companyId: string, updateData: Partial<ICompany>): Promise<ICompany> {
    try {
      // Validate update data
      await validateCompanyData(updateData as ICompany);

      // Retrieve existing company
      const existingCompany = await this.companyModel.findById(companyId);
      if (!existingCompany) {
        throw new Error('Company not found');
      }

      // Encrypt updated sensitive fields
      const encryptedData = this.encryptSensitiveFields(updateData);

      // Update company with audit trail
      const updatedCompany = await this.companyModel.findByIdAndUpdate(
        companyId,
        {
          ...encryptedData,
          updatedAt: new Date()
        },
        { new: true }
      );

      // Update cache
      await this.cacheCompanyData(companyId, updatedCompany);

      // Log update
      this.logger.info('Company updated', {
        companyId,
        updatedFields: Object.keys(updateData)
      });

      return this.maskSensitiveData(updatedCompany);
    } catch (error) {
      this.logger.error('Company update failed', { companyId, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieves company profile by ID with security checks
   * @param companyId Company identifier
   * @returns Company profile with masked sensitive data
   */
  async getCompanyById(companyId: string): Promise<ICompany> {
    try {
      // Check cache first
      const cachedCompany = await this.cacheManager.get<ICompany>(`company:${companyId}`);
      if (cachedCompany) {
        return this.maskSensitiveData(cachedCompany);
      }

      // Retrieve from database
      const company = await this.companyModel.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Cache company data
      await this.cacheCompanyData(companyId, company);

      // Log access
      this.logger.info('Company retrieved', { companyId });

      return this.maskSensitiveData(company);
    } catch (error) {
      this.logger.error('Company retrieval failed', { companyId, error: error.message });
      throw error;
    }
  }

  /**
   * Encrypts sensitive company fields using AES-256
   * @param data Company data containing sensitive fields
   * @returns Encrypted company data
   */
  private encryptSensitiveFields(data: Partial<ICompany>): Partial<ICompany> {
    const encryptedData = { ...data };

    for (const field of SENSITIVE_FIELDS) {
      const value = this.getNestedValue(encryptedData, field);
      if (value) {
        this.setNestedValue(
          encryptedData,
          field,
          this.encrypt(value.toString())
        );
      }
    }

    return encryptedData;
  }

  /**
   * Masks sensitive data for external responses
   * @param company Company data to mask
   * @returns Masked company data
   */
  private maskSensitiveData(company: ICompany): ICompany {
    const maskedCompany = { ...company };

    for (const field of SENSITIVE_FIELDS) {
      const value = this.getNestedValue(maskedCompany, field);
      if (value) {
        this.setNestedValue(
          maskedCompany,
          field,
          this.maskValue(this.decrypt(value))
        );
      }
    }

    return maskedCompany;
  }

  /**
   * Caches company data with TTL
   * @param companyId Company identifier
   * @param data Company data to cache
   */
  private async cacheCompanyData(companyId: string, data: ICompany): Promise<void> {
    await this.cacheManager.set(
      `company:${companyId}`,
      data,
      { ttl: COMPANY_CACHE_TTL }
    );
  }

  /**
   * Encrypts value using AES-256
   * @param value Value to encrypt
   * @returns Encrypted value
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
  }

  /**
   * Decrypts encrypted value
   * @param encrypted Encrypted value
   * @returns Decrypted value
   */
  private decrypt(encrypted: string): string {
    const [ivHex, encryptedHex, tagHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encryptedText) + decipher.final('utf8');
  }

  /**
   * Masks a value for external display
   * @param value Value to mask
   * @returns Masked value
   */
  private maskValue(value: string): string {
    if (value.includes('@')) {
      // Mask email
      const [local, domain] = value.split('@');
      return `${local.charAt(0)}***@${domain}`;
    }
    // Mask other values
    return `${value.charAt(0)}****${value.charAt(value.length - 1)}`;
  }

  /**
   * Gets nested object value using dot notation
   * @param obj Object to traverse
   * @param path Dot notation path
   * @returns Nested value
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Sets nested object value using dot notation
   * @param obj Object to modify
   * @param path Dot notation path
   * @param value Value to set
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const lastObj = keys.reduce((curr, key) => curr[key] = curr[key] || {}, obj);
    lastObj[lastKey] = value;
  }
}