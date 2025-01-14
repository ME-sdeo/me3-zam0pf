/**
 * @file User validator implementation for MyElixir healthcare data marketplace
 * @version 1.0.0
 * @description Implements HIPAA-compliant validation rules for user-related data
 */

import Joi from 'joi'; // version: 17.9.0
import { IUser, UserRole, UserStatus } from '../interfaces/user.interface';
import {
  USER_VALIDATION,
  EMAIL_VALIDATION,
  PHONE_VALIDATION
} from '../constants/validation.constants';
import { ERROR_MESSAGES } from '../constants/error.constants';

/**
 * Schema for MFA configuration validation
 * Implements secure multi-factor authentication requirements
 */
const mfaConfigurationSchema = Joi.object({
  method: Joi.string()
    .valid('AUTHENTICATOR', 'SMS', 'EMAIL')
    .required()
    .messages({
      'any.required': 'MFA method is required for HIPAA compliance',
      'any.only': 'Invalid MFA method selected'
    }),
  backupCodes: Joi.when('method', {
    is: 'AUTHENTICATOR',
    then: Joi.array()
      .items(Joi.string().length(8))
      .length(10)
      .required()
      .messages({
        'array.length': 'Exactly 10 backup codes are required',
        'string.length': 'Each backup code must be 8 characters'
      }),
    otherwise: Joi.forbidden()
  }),
  phoneNumber: Joi.when('method', {
    is: 'SMS',
    then: Joi.string()
      .pattern(PHONE_VALIDATION.PHONE_PATTERN)
      .required()
      .messages({
        'string.pattern.base': 'Invalid phone number format for SMS MFA'
      }),
    otherwise: Joi.forbidden()
  })
});

/**
 * Schema for healthcare identifiers validation
 * Ensures proper format of medical identification numbers
 */
const healthcareIdentifiersSchema = Joi.object({
  mrn: Joi.string()
    .pattern(/^[A-Z0-9]{6,10}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid Medical Record Number (MRN) format'
    }),
  npi: Joi.string()
    .pattern(/^\d{10}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid National Provider Identifier (NPI) format'
    })
});

/**
 * Schema for user profile validation
 * Implements HIPAA-compliant personal information validation
 */
const userProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(USER_VALIDATION.NAME_MIN_LENGTH)
    .max(USER_VALIDATION.NAME_MAX_LENGTH)
    .required()
    .messages({
      'string.min': `First name must be at least ${USER_VALIDATION.NAME_MIN_LENGTH} characters`,
      'string.max': `First name cannot exceed ${USER_VALIDATION.NAME_MAX_LENGTH} characters`
    }),
  lastName: Joi.string()
    .min(USER_VALIDATION.NAME_MIN_LENGTH)
    .max(USER_VALIDATION.NAME_MAX_LENGTH)
    .required(),
  dateOfBirth: Joi.date()
    .iso()
    .max('now')
    .required()
    .messages({
      'date.format': 'Date of birth must be in ISO format',
      'date.max': 'Date of birth cannot be in the future'
    }),
  phone: Joi.string()
    .pattern(PHONE_VALIDATION.PHONE_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  address: Joi.string()
    .required()
    .min(5)
    .max(200)
    .messages({
      'string.min': 'Address is too short',
      'string.max': 'Address is too long'
    }),
  healthcareIdentifiers: healthcareIdentifiersSchema
});

/**
 * Schema for user preferences validation
 * Ensures proper format of user settings and preferences
 */
export const updateUserPreferencesSchema = Joi.object({
  notificationPreferences: Joi.array()
    .items(Joi.string().valid('EMAIL', 'SMS', 'PUSH'))
    .min(1)
    .unique(),
  dataVisibility: Joi.array()
    .items(Joi.string().valid('PUBLIC', 'PRIVATE', 'SELECTIVE'))
    .min(1)
    .unique(),
  defaultConsentDuration: Joi.number()
    .min(1)
    .max(365)
    .default(30)
});

/**
 * Schema for user creation
 * Implements comprehensive validation for new user registration
 */
export const createUserSchema = Joi.object({
  email: Joi.string()
    .pattern(EMAIL_VALIDATION.EMAIL_PATTERN)
    .max(EMAIL_VALIDATION.MAX_LENGTH)
    .required()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'string.max': `Email cannot exceed ${EMAIL_VALIDATION.MAX_LENGTH} characters`
    }),
  password: Joi.string()
    .pattern(USER_VALIDATION.PASSWORD_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character'
    }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': 'Invalid user role specified'
    }),
  status: Joi.string()
    .valid(...Object.values(UserStatus))
    .default(UserStatus.PENDING_VERIFICATION),
  profile: userProfileSchema.required(),
  mfaConfiguration: mfaConfigurationSchema.required()
});

/**
 * Schema for user updates
 * Implements validation for user profile updates
 */
export const updateUserSchema = Joi.object({
  profile: userProfileSchema,
  mfaConfiguration: mfaConfigurationSchema,
  status: Joi.string().valid(...Object.values(UserStatus))
}).min(1);

/**
 * Validates user data against the specified schema
 * Implements comprehensive validation with HIPAA compliance checks
 * 
 * @param data - The user data to validate
 * @param schema - The validation schema to use
 * @returns Promise resolving to validation result
 * @throws ValidationError if validation fails
 */
export const validateUserData = async (
  data: Record<string, any>,
  schema: Joi.ObjectSchema
): Promise<{ value: any; error?: string }> => {
  try {
    // Sanitize input data to prevent XSS
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value.replace(/[<>]/g, '');
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    // Validate against schema
    const { error, value } = await schema.validateAsync(sanitizedData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      return { value: null, error: errorMessage };
    }

    // Additional HIPAA compliance checks
    if (value.profile?.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(value.profile.dateOfBirth).getFullYear();
      if (age < 18) {
        return { value: null, error: 'User must be at least 18 years old' };
      }
    }

    return { value };
  } catch (error) {
    return {
      value: null,
      error: ERROR_MESSAGES.AUTH_001
    };
  }
};