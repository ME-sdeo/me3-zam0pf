import { describe, test, expect } from '@jest/globals';
import { Resource } from '@medplum/fhirtypes';
import {
  validateEmail,
  validatePassword,
  validateName,
  validateFHIRResource,
  validateFHIRFile
} from '../../src/utils/validation.util';
import {
  USER_VALIDATION,
  FHIR_VALIDATION,
  FORM_VALIDATION_MESSAGES
} from '../../src/constants/validation.constants';
import { ValidationSeverity, FHIRValidationErrorType } from '../../src/interfaces/fhir.interface';

describe('Email Validation', () => {
  test('should validate standard email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+label@domain.com'
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  test('should validate international email formats', () => {
    const validInternationalEmails = [
      'user@domain.co.jp',
      'user@domain.香港',
      'user@domain.рф'
    ];

    validInternationalEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  test('should reject invalid email formats', () => {
    const invalidEmails = [
      '',
      'invalid',
      '@domain.com',
      'user@',
      'user@domain',
      'user@.com'
    ];

    invalidEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FORM_VALIDATION_MESSAGES.INVALID_EMAIL);
    });
  });

  test('should enforce strict mode validation rules', () => {
    const strictModeTests = [
      { email: 'a@b.com', expected: false },
      { email: 'ab@b.com', expected: false },
      { email: 'user@x.com', expected: false },
      { email: 'user@domain.com', expected: true }
    ];

    strictModeTests.forEach(({ email, expected }) => {
      const result = validateEmail(email, true);
      expect(result.isValid).toBe(expected);
    });
  });
});

describe('FHIR Resource Validation', () => {
  const validPatientResource: Resource = {
    resourceType: 'Patient',
    id: '123',
    identifier: [{ system: 'urn:system', value: '12345' }],
    name: [{ family: 'Doe', given: ['John'] }],
    birthDate: '1990-01-01'
  };

  test('should validate correct FHIR resources', async () => {
    const result = await validateFHIRResource(validPatientResource);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.processingTime).toBeLessThan(1000);
  });

  test('should validate required fields', async () => {
    const invalidPatient = { ...validPatientResource };
    delete invalidPatient.identifier;

    const result = await validateFHIRResource(invalidPatient);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      type: FHIRValidationErrorType.Required,
      field: 'identifier',
      severity: ValidationSeverity.Error
    }));
  });

  test('should validate resource type', async () => {
    const invalidResource = {
      ...validPatientResource,
      resourceType: 'InvalidType'
    };

    const result = await validateFHIRResource(invalidResource);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      type: FHIRValidationErrorType.Value,
      field: 'resourceType'
    }));
  });

  test('should track validation performance', async () => {
    const result = await validateFHIRResource(validPatientResource);
    expect(result.processingTime).toBeGreaterThan(0);
    expect(result.resourceCount).toBe(1);
  });

  test('should handle validation timeouts', async () => {
    const largeResource = {
      ...validPatientResource,
      data: 'x'.repeat(FHIR_VALIDATION.MAX_RESOURCE_SIZE + 1)
    };

    const result = await validateFHIRResource(largeResource);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'FILE_SIZE_WARNING'
    }));
  });
});

describe('FHIR File Validation', () => {
  const validFHIRFile = new File(
    [JSON.stringify(validPatientResource)],
    'patient.json',
    { type: 'application/json' }
  );

  test('should validate correct FHIR files', async () => {
    const result = await validateFHIRFile(validFHIRFile);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate file size limits', async () => {
    const largeFile = new File(
      ['x'.repeat(FHIR_VALIDATION.MAX_RESOURCE_SIZE + 1)],
      'large.json',
      { type: 'application/json' }
    );

    const result = await validateFHIRFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: 'FILE_SIZE_ERROR'
    }));
  });

  test('should validate file types', async () => {
    const invalidFile = new File(
      ['invalid content'],
      'invalid.txt',
      { type: 'text/plain' }
    );

    const result = await validateFHIRFile(invalidFile);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      message: FORM_VALIDATION_MESSAGES.INVALID_FILE_TYPE
    }));
  });

  test('should validate file content', async () => {
    const invalidContent = new File(
      ['not valid json'],
      'invalid.json',
      { type: 'application/json' }
    );

    const result = await validateFHIRFile(invalidContent);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      type: FHIRValidationErrorType.Format
    }));
  });
});

describe('Performance Metrics', () => {
  test('should complete validation within timeout limit', async () => {
    const startTime = Date.now();
    const result = await validateFHIRResource(validPatientResource);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(FHIR_VALIDATION.VALIDATION_TIMEOUT);
    expect(result.processingTime).toBeLessThan(FHIR_VALIDATION.VALIDATION_TIMEOUT);
  });

  test('should handle batch validation efficiently', async () => {
    const resources = Array(10).fill(validPatientResource);
    const startTime = Date.now();

    const results = await Promise.all(
      resources.map(resource => validateFHIRResource(resource))
    );

    const totalDuration = Date.now() - startTime;
    const averageTime = totalDuration / resources.length;

    expect(averageTime).toBeLessThan(500); // 500ms per resource
    results.forEach(result => {
      expect(result.processingTime).toBeLessThan(500);
    });
  });
});