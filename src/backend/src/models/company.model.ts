import { Schema, model } from 'mongoose';
import { 
  ICompany, 
  CompanyType, 
  CompanyStatus, 
  VerificationStatus, 
  ICompanyProfile, 
  ICompanyBilling 
} from '../interfaces/company.interface';
import { IsEmail, IsNotEmpty, ValidateNested } from 'class-validator';
import { plainToClass, Type } from 'class-transformer';
import * as CryptoJS from 'crypto-js'; // v4.1.1
import { AuditLogger } from 'audit-logging'; // v2.0.0

// Collection name constant
const COMPANY_COLLECTION = 'companies';

// Fields that require encryption for HIPAA compliance
const ENCRYPTED_FIELDS = ['email', 'phone', 'taxId', 'complianceEmail', 'billingEmail'];

// Encryption key from environment variables
const ENCRYPTION_KEY = process.env.COMPANY_ENCRYPTION_KEY || '';

// Audit logger instance for HIPAA compliance
const auditLogger = new AuditLogger({
  service: 'CompanyModel',
  logLevel: 'info',
  hipaaCompliant: true
});

/**
 * Mongoose schema for healthcare companies with HIPAA compliance
 * Implements comprehensive validation and field-level encryption
 */
@Schema({ timestamps: true })
class CompanySchema {
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  type: CompanyType;

  @IsNotEmpty()
  status: CompanyStatus;

  @IsNotEmpty()
  verificationStatus: VerificationStatus;

  @ValidateNested()
  @Type(() => Object)
  profile: ICompanyProfile;

  @ValidateNested()
  @Type(() => Object)
  billingInfo: ICompanyBilling;

  createdAt: Date;
  updatedAt: Date;
  lastVerifiedAt: Date;
  verificationHash: string;

  /**
   * Encrypts sensitive field data using AES-256 encryption
   * @param value Field value to encrypt
   * @returns Encrypted value
   */
  private encryptField(value: string): string {
    return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypts encrypted field data
   * @param value Encrypted field value
   * @returns Decrypted value
   */
  private decryptField(value: string): string {
    const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Pre-save middleware for validation and encryption
   */
  @Schema.pre('save')
  async preSave(): Promise<void> {
    // Update timestamps
    this.updatedAt = new Date();
    if (!this.createdAt) {
      this.createdAt = new Date();
    }

    // Validate company data
    const companyData = plainToClass(CompanySchema, this);
    await this.validateCompanyData(companyData);

    // Encrypt sensitive fields
    for (const field of ENCRYPTED_FIELDS) {
      if (this[field]) {
        this[field] = this.encryptField(this[field]);
      }
    }

    // Generate verification hash
    this.verificationHash = CryptoJS.SHA256(
      `${this.id}${this.email}${this.updatedAt}`
    ).toString();

    // Log audit trail
    await auditLogger.log({
      action: 'COMPANY_UPDATE',
      entityId: this.id,
      entityType: 'Company',
      changes: {
        updatedAt: this.updatedAt,
        verificationStatus: this.verificationStatus
      }
    });
  }

  /**
   * Validates company data against business rules and compliance requirements
   * @param companyData Company data to validate
   * @returns Validation result
   */
  private async validateCompanyData(companyData: ICompany): Promise<boolean> {
    // Validate required certifications
    const requiredCerts = ['HIPAA', 'HITECH'];
    const companyCerts = companyData.profile.certifications.map(cert => cert.type);
    
    if (!requiredCerts.every(cert => companyCerts.includes(cert))) {
      throw new Error('Missing required healthcare certifications');
    }

    // Validate certification dates
    const now = new Date();
    const expiredCerts = companyData.profile.certifications.filter(
      cert => cert.expiresAt < now
    );

    if (expiredCerts.length > 0) {
      throw new Error('One or more certifications have expired');
    }

    // Additional business validations
    if (!companyData.profile.complianceOfficer || !companyData.profile.complianceEmail) {
      throw new Error('Compliance officer information is required');
    }

    return true;
  }

  /**
   * Custom JSON serialization for secure data handling
   * @returns Sanitized company data
   */
  toJSON() {
    const obj = this.toObject();

    // Decrypt necessary fields for JSON response
    for (const field of ENCRYPTED_FIELDS) {
      if (obj[field]) {
        obj[field] = this.decryptField(obj[field]);
      }
    }

    // Remove sensitive internal fields
    delete obj.verificationHash;
    delete obj.__v;

    // Transform MongoDB _id to id
    obj.id = obj._id.toString();
    delete obj._id;

    return obj;
  }
}

// Create indexes for performance and compliance
const companySchema = new Schema<ICompany>(CompanySchema, {
  collection: COMPANY_COLLECTION,
  timestamps: true,
  toJSON: { virtuals: true }
});

companySchema.index({ email: 1 }, { unique: true });
companySchema.index({ 'profile.certifications.expiresAt': 1 });
companySchema.index({ verificationStatus: 1 });
companySchema.index({ updatedAt: 1 });

// Export the model
const CompanyModel = model<ICompany>(COMPANY_COLLECTION, companySchema);
export default CompanyModel;