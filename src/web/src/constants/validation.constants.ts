/**
 * @fileoverview Validation constants for MyElixir healthcare data marketplace
 * Implements comprehensive validation rules for forms, FHIR resources, and user inputs
 * with focus on healthcare data security and compliance
 * @version 1.0.0
 */

/**
 * User input validation rules and constraints
 * Ensures secure user data handling and access control
 */
export const USER_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_PATTERN: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
  PHONE_PATTERN: /^\+?[1-9]\d{1,14}$/,
  MFA_CODE_LENGTH: 6
} as const;

/**
 * FHIR resource validation rules and constraints
 * Ensures 99.9% FHIR validation success rate through strict validation
 */
export const FHIR_VALIDATION = {
  RESOURCE_TYPES: [
    'Patient',
    'Observation',
    'Condition',
    'Procedure',
    'MedicationStatement',
    'DiagnosticReport',
    'AllergyIntolerance',
    'Immunization',
    'CarePlan'
  ],
  MAX_RESOURCE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['.json', '.xml', '.pdf'],
  FHIR_VERSION: '4.0.1',
  REQUIRED_FIELDS: {
    Patient: ['identifier', 'name', 'birthDate'],
    Observation: ['code', 'status', 'subject'],
    Condition: ['code', 'subject', 'clinicalStatus']
  },
  VALIDATION_SCHEMAS: {
    Patient: {
      type: 'object',
      properties: {
        resourceType: { const: 'Patient' },
        identifier: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['system', 'value']
          }
        },
        name: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['family', 'given']
          }
        },
        birthDate: {
          type: 'string',
          pattern: '^\d{4}-\d{2}-\d{2}$'
        }
      },
      required: ['resourceType', 'identifier', 'name', 'birthDate']
    },
    Observation: {
      type: 'object',
      properties: {
        resourceType: { const: 'Observation' },
        status: {
          type: 'string',
          enum: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']
        },
        code: {
          type: 'object',
          required: ['coding']
        },
        subject: {
          type: 'object',
          required: ['reference']
        }
      },
      required: ['resourceType', 'status', 'code', 'subject']
    }
  }
} as const;

/**
 * Form validation error messages
 * Provides accessible and user-friendly validation feedback
 */
export const FORM_VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must contain at least 12 characters, including uppercase, lowercase, number, and special character',
  INVALID_NAME: 'Name must be between 2 and 50 characters',
  INVALID_FILE_TYPE: 'Invalid file type. Allowed types: JSON, XML, PDF',
  FILE_TOO_LARGE: 'File size exceeds 5MB limit',
  INVALID_FHIR_RESOURCE: 'Invalid FHIR resource format or missing required fields',
  INVALID_PHONE: 'Please enter a valid international phone number',
  INVALID_MFA_CODE: 'Please enter a valid 6-digit MFA code'
} as const;

/**
 * Input validation helper functions
 */
export const validateEmail = (email: string): boolean => {
  return USER_VALIDATION.EMAIL_PATTERN.test(email);
};

export const validatePassword = (password: string): boolean => {
  return USER_VALIDATION.PASSWORD_PATTERN.test(password);
};

export const validatePhone = (phone: string): boolean => {
  return USER_VALIDATION.PHONE_PATTERN.test(phone);
};

export const validateMfaCode = (code: string): boolean => {
  return code.length === USER_VALIDATION.MFA_CODE_LENGTH && /^\d+$/.test(code);
};

export const validateFhirResourceType = (resourceType: string): boolean => {
  return FHIR_VALIDATION.RESOURCE_TYPES.includes(resourceType);
};

export const validateFileType = (fileName: string): boolean => {
  return FHIR_VALIDATION.ALLOWED_FILE_TYPES.some(type => 
    fileName.toLowerCase().endsWith(type)
  );
};

export const validateFileSize = (size: number): boolean => {
  return size <= FHIR_VALIDATION.MAX_RESOURCE_SIZE;
};