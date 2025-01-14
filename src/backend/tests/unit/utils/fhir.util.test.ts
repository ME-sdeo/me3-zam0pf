import { validateFHIRResource, transformToFHIR } from '../../../src/utils/fhir.util';
import { FHIR_ERROR_MESSAGES, FHIR_VALIDATION_RULES } from '../../../src/constants/fhir.constants';
import { FHIRResource, FHIRValidationResult } from '../../../src/interfaces/fhir.interface';
import { performance } from 'performance-now';
import { createHash, randomBytes } from 'crypto';

// Mock valid FHIR Patient resource
const mockValidPatient: FHIRResource = {
  resourceType: 'Patient',
  id: createHash('sha256').update(randomBytes(32)).digest('hex').substring(0, 32),
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
    profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
  },
  name: [{
    family: 'Smith',
    given: ['John']
  }],
  gender: 'male',
  birthDate: '1990-01-01'
};

// Mock invalid FHIR Patient resource
const mockInvalidPatient: FHIRResource = {
  resourceType: 'Patient',
  id: createHash('sha256').update(randomBytes(32)).digest('hex').substring(0, 32),
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString()
  }
  // Missing required fields: name, gender, birthDate
};

// Mock raw health data
const mockRawHealthData = {
  firstName: 'John',
  lastName: 'Smith',
  gender: 'male',
  dateOfBirth: '1990-01-01',
  ssn: '123-45-6789',
  phone: '+1-555-555-5555'
};

describe('validateFHIRResource', () => {
  let startTime: number;

  beforeEach(() => {
    startTime = performance();
  });

  afterEach(() => {
    const endTime = performance();
    const duration = endTime - startTime;
    // Ensure validation performance meets requirements
    expect(duration).toBeLessThan(1000); // Max 1 second per validation
  });

  test('should validate a valid FHIR Patient resource', async () => {
    const result: FHIRValidationResult = await validateFHIRResource(mockValidPatient);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.successRate).toBeGreaterThanOrEqual(0.999); // 99.9% success rate
    expect(result.performanceMetrics.validationTime).toBeDefined();
    expect(result.performanceMetrics.resourceSize).toBeDefined();
  });

  test('should reject an invalid FHIR Patient resource', async () => {
    const result: FHIRValidationResult = await validateFHIRResource(mockInvalidPatient);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3); // Missing name, gender, birthDate
    expect(result.errors[0].type).toBe('Required');
    expect(result.stats.successRate).toBeLessThan(1);
  });

  test('should validate resource size limits', async () => {
    const largeResource = {
      ...mockValidPatient,
      // Add large data to exceed size limit
      note: Array(FHIR_VALIDATION_RULES.MAX_FIELD_LENGTH + 1).fill('x').join('')
    };

    const result = await validateFHIRResource(largeResource);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe(FHIR_ERROR_MESSAGES.RESOURCE_TOO_LARGE);
  });

  test('should cache validation results', async () => {
    // First validation
    const firstResult = await validateFHIRResource(mockValidPatient);
    const firstTime = firstResult.performanceMetrics.validationTime;

    // Second validation (should be cached)
    const secondResult = await validateFHIRResource(mockValidPatient);
    const secondTime = secondResult.performanceMetrics.validationTime;

    expect(secondTime).toBeLessThan(firstTime);
  });
});

describe('transformToFHIR', () => {
  test('should transform raw data to valid FHIR Patient resource', async () => {
    const result = await transformToFHIR(mockRawHealthData, 'Patient', {
      encryptSensitive: true,
      validateOutput: true
    });

    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBeDefined();
    expect(result.meta).toBeDefined();
    expect(result.name[0].family).toBe('Smith');
    expect(result.gender).toBe('male');
    expect(result.birthDate).toBe('1990-01-01');
  });

  test('should encrypt sensitive fields', async () => {
    const result = await transformToFHIR(mockRawHealthData, 'Patient', {
      encryptSensitive: true
    });

    // Verify SSN and phone are encrypted
    expect(typeof result['ssn']).toBe('object');
    expect(result['ssn'].iv).toBeDefined();
    expect(result['ssn'].data).toBeDefined();
    expect(typeof result['phone']).toBe('object');
    expect(result['phone'].iv).toBeDefined();
    expect(result['phone'].data).toBeDefined();
  });

  test('should add required metadata', async () => {
    const result = await transformToFHIR(mockRawHealthData, 'Patient', {
      addMetadata: true
    });

    expect(result.meta.security).toBeDefined();
    expect(result.meta.tag).toBeDefined();
    expect(result.meta.profile).toContain('http://hl7.org/fhir/StructureDefinition/Patient');
  });

  test('should reject invalid raw data', async () => {
    const invalidData = {
      firstName: 'John'
      // Missing required fields
    };

    await expect(transformToFHIR(invalidData, 'Patient', {
      validateOutput: true
    })).rejects.toThrow(FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT);
  });

  test('should handle empty or null input', async () => {
    await expect(transformToFHIR(null, 'Patient')).rejects.toThrow();
    await expect(transformToFHIR({}, 'Patient')).rejects.toThrow();
  });
});

describe('Performance and Security', () => {
  test('should meet performance requirements under load', async () => {
    const resources = Array(100).fill(mockValidPatient);
    const startTime = performance();
    
    await Promise.all(resources.map(resource => validateFHIRResource(resource)));
    
    const duration = performance() - startTime;
    const averageTime = duration / 100;
    
    expect(averageTime).toBeLessThan(10); // Max 10ms per validation
  });

  test('should maintain validation accuracy under load', async () => {
    const resources = Array(100).fill(mockValidPatient);
    const results = await Promise.all(resources.map(resource => validateFHIRResource(resource)));
    
    const successRate = results.filter(r => r.valid).length / results.length;
    expect(successRate).toBeGreaterThanOrEqual(0.999); // 99.9% success rate
  });

  test('should prevent validation bypass attempts', async () => {
    const maliciousResource = {
      ...mockValidPatient,
      '__proto__': { malicious: true }
    };

    const result = await validateFHIRResource(maliciousResource);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('security') })
    );
  });
});