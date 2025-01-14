import Joi from 'joi';
import { 
  CompanyType, 
  CompanyStatus, 
  VerificationStatus, 
  CertificationType, 
  PaymentMethod 
} from '../interfaces/company.interface';
import { EMAIL_VALIDATION, PHONE_VALIDATION } from '../constants/validation.constants';
import { ErrorCode, getErrorMessage } from '../constants/error.constants';

// Constants for company validation
const COMPANY_NAME_MIN_LENGTH = 2;
const COMPANY_NAME_MAX_LENGTH = 100;
const COMPANY_DESCRIPTION_MAX_LENGTH = 1000;
const WEBSITE_URL_PATTERN = /^https?:\/\/[\w\-]+(\.[\w\-]+)+[/#?]?.*$/;
const CERTIFICATION_EXPIRY_WINDOW_DAYS = 90;

// Address validation schema with enhanced verification
const addressSchema = Joi.object({
  street: Joi.string().required().trim().max(100),
  city: Joi.string().required().trim().max(50),
  state: Joi.string().required().trim().max(50),
  country: Joi.string().required().trim().max(50),
  postalCode: Joi.string().required().trim().max(20)
    .pattern(/^[A-Z0-9\-\s]{3,20}$/i)
}).required();

// Certification validation schema with HIPAA compliance checks
const certificationSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(CertificationType))
    .required(),
  number: Joi.string()
    .required()
    .pattern(/^[A-Z0-9\-]{6,50}$/),
  issuedAt: Joi.date()
    .iso()
    .required()
    .less('now'),
  expiresAt: Joi.date()
    .iso()
    .required()
    .greater(Joi.ref('issuedAt'))
    .min('now'),
  verificationDocument: Joi.string()
    .required()
    .pattern(/^https:\/\/.*\.(?:pdf|jpg|png)$/)
});

// Company profile validation schema
const profileSchema = Joi.object({
  description: Joi.string()
    .required()
    .trim()
    .max(COMPANY_DESCRIPTION_MAX_LENGTH),
  website: Joi.string()
    .required()
    .pattern(WEBSITE_URL_PATTERN),
  address: addressSchema,
  phone: Joi.string()
    .required()
    .pattern(PHONE_VALIDATION.PHONE_PATTERN)
    .max(PHONE_VALIDATION.MAX_LENGTH),
  researchAreas: Joi.array()
    .items(Joi.string().trim().max(100))
    .min(1)
    .max(10)
    .required(),
  certifications: Joi.array()
    .items(certificationSchema)
    .min(1)
    .required(),
  complianceOfficer: Joi.string()
    .required()
    .trim()
    .max(100),
  complianceEmail: Joi.string()
    .required()
    .pattern(EMAIL_VALIDATION.EMAIL_PATTERN)
    .max(EMAIL_VALIDATION.MAX_LENGTH)
});

// Billing information validation schema
const billingSchema = Joi.object({
  paymentMethod: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required(),
  billingAddress: addressSchema,
  taxId: Joi.string()
    .required()
    .pattern(/^[A-Z0-9\-]{6,50}$/),
  billingEmail: Joi.string()
    .required()
    .pattern(EMAIL_VALIDATION.EMAIL_PATTERN)
    .max(EMAIL_VALIDATION.MAX_LENGTH),
  billingContact: Joi.string()
    .required()
    .trim()
    .max(100)
});

// Company registration validation schema
const registrationSchema = Joi.object({
  name: Joi.string()
    .required()
    .trim()
    .min(COMPANY_NAME_MIN_LENGTH)
    .max(COMPANY_NAME_MAX_LENGTH),
  email: Joi.string()
    .required()
    .pattern(EMAIL_VALIDATION.EMAIL_PATTERN)
    .max(EMAIL_VALIDATION.MAX_LENGTH),
  type: Joi.string()
    .valid(...Object.values(CompanyType))
    .required(),
  profile: profileSchema.required(),
  billingInfo: billingSchema.required()
}).options({ abortEarly: false });

// Company update validation schema
const updateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(COMPANY_NAME_MIN_LENGTH)
    .max(COMPANY_NAME_MAX_LENGTH),
  email: Joi.string()
    .pattern(EMAIL_VALIDATION.EMAIL_PATTERN)
    .max(EMAIL_VALIDATION.MAX_LENGTH),
  status: Joi.string()
    .valid(...Object.values(CompanyStatus)),
  verificationStatus: Joi.string()
    .valid(...Object.values(VerificationStatus)),
  profile: profileSchema,
  billingInfo: billingSchema
}).min(1).options({ abortEarly: false });

// Enhanced validation functions with HIPAA compliance checks
const validateCertificationExpiry = (certifications: any[]): boolean => {
  const now = new Date();
  return certifications.every(cert => {
    const expiryDate = new Date(cert.expiresAt);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > CERTIFICATION_EXPIRY_WINDOW_DAYS;
  });
};

// Export validation schemas and helper functions
export const companyValidationSchemas = {
  registration: registrationSchema,
  update: updateSchema,
  billing: billingSchema,
  
  async validateCompanyRegistration(data: any) {
    try {
      const validatedData = await registrationSchema.validateAsync(data);
      
      // Additional HIPAA compliance checks
      if (!validateCertificationExpiry(validatedData.profile.certifications)) {
        throw new Error(getErrorMessage(ErrorCode.CONS_001));
      }
      
      return {
        isValid: true,
        data: validatedData
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.details || error.message
      };
    }
  },

  async validateCompanyUpdate(data: any) {
    try {
      const validatedData = await updateSchema.validateAsync(data);
      
      if (validatedData.profile?.certifications && 
          !validateCertificationExpiry(validatedData.profile.certifications)) {
        throw new Error(getErrorMessage(ErrorCode.CONS_001));
      }
      
      return {
        isValid: true,
        data: validatedData
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.details || error.message
      };
    }
  },

  async validateBillingInfo(data: any) {
    try {
      const validatedData = await billingSchema.validateAsync(data);
      return {
        isValid: true,
        data: validatedData
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.details || error.message
      };
    }
  }
};