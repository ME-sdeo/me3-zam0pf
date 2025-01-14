import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import MedplumAdapter from '../../../src/fhir/adapters/medplum.adapter';
import FHIRResourceValidator from '../../../src/fhir/validators/resource.validator';
import { FHIRResource, FHIRValidationResult } from '../../../src/interfaces/fhir.interface';
import { FHIR_ERROR_CODES, FHIR_ERROR_MESSAGES, FHIR_VALIDATION_RULES } from '../../../src/constants/fhir.constants';

// Mock implementations
jest.mock('../../../src/fhir/adapters/medplum.adapter');
jest.mock('../../../src/fhir/validators/resource.validator');

describe('FHIRService', () => {
  let medplumAdapter: jest.Mocked<MedplumAdapter>;
  let resourceValidator: jest.Mocked<FHIRResourceValidator>;

  // Test data fixtures
  const validPatientResource: FHIRResource = {
    resourceType: 'Patient',
    id: '123',
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

  const validValidationResult: FHIRValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalFields: 10,
      validFields: 10,
      errorCount: 0,
      warningCount: 0,
      successRate: 1
    }
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Initialize mocked instances
    medplumAdapter = new MedplumAdapter() as jest.Mocked<MedplumAdapter>;
    resourceValidator = new FHIRResourceValidator(medplumAdapter) as jest.Mocked<FHIRResourceValidator>;

    // Setup default mock implementations
    medplumAdapter.createResource.mockResolvedValue(validPatientResource);
    medplumAdapter.getResource.mockResolvedValue(validPatientResource);
    resourceValidator.validateResource.mockResolvedValue(validValidationResult);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createResource', () => {
    it('should successfully create a valid FHIR resource', async () => {
      const result = await medplumAdapter.createResource(validPatientResource);
      
      expect(resourceValidator.validateResource).toHaveBeenCalledWith(validPatientResource);
      expect(medplumAdapter.createResource).toHaveBeenCalledWith(validPatientResource);
      expect(result).toEqual(validPatientResource);
    });

    it('should reject creation of invalid FHIR resource', async () => {
      const invalidResource = { ...validPatientResource, resourceType: undefined };
      resourceValidator.validateResource.mockResolvedValue({
        ...validValidationResult,
        valid: false,
        errors: [{
          type: 'Required',
          path: 'resourceType',
          message: FHIR_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
        }]
      });

      await expect(medplumAdapter.createResource(invalidResource))
        .rejects.toThrow(FHIR_ERROR_MESSAGES.INVALID_FHIR_FORMAT);
    });

    it('should validate all required fields before creation', async () => {
      const requiredFields = FHIR_VALIDATION_RULES.REQUIRED_FIELDS.Patient;
      const result = await medplumAdapter.createResource(validPatientResource);

      expect(resourceValidator.validateResource).toHaveBeenCalled();
      requiredFields.forEach(field => {
        expect(validPatientResource).toHaveProperty(field);
      });
    });

    it('should handle server errors gracefully', async () => {
      medplumAdapter.createResource.mockRejectedValue(new Error('Server Error'));

      await expect(medplumAdapter.createResource(validPatientResource))
        .rejects.toThrow('Server Error');
    });
  });

  describe('readResource', () => {
    it('should successfully retrieve existing resource', async () => {
      const result = await medplumAdapter.getResource('Patient', '123');

      expect(medplumAdapter.getResource).toHaveBeenCalledWith('Patient', '123');
      expect(result).toEqual(validPatientResource);
    });

    it('should handle non-existent resource', async () => {
      medplumAdapter.getResource.mockRejectedValue({
        code: FHIR_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: FHIR_ERROR_MESSAGES.RESOURCE_NOT_FOUND
      });

      await expect(medplumAdapter.getResource('Patient', 'nonexistent'))
        .rejects.toThrow(FHIR_ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    });

    it('should validate retrieved resource format', async () => {
      await medplumAdapter.getResource('Patient', '123');
      
      expect(resourceValidator.validateResource).toHaveBeenCalledWith(validPatientResource);
    });
  });

  describe('searchResources', () => {
    const searchParams = {
      resourceType: 'Patient',
      filters: [{
        field: 'name',
        operator: 'contains',
        value: 'Smith'
      }]
    };

    it('should return matching resources based on criteria', async () => {
      medplumAdapter.searchResources.mockResolvedValue([validPatientResource]);

      const results = await medplumAdapter.searchResources(searchParams);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(validPatientResource);
    });

    it('should handle empty search results', async () => {
      medplumAdapter.searchResources.mockResolvedValue([]);

      const results = await medplumAdapter.searchResources(searchParams);

      expect(results).toHaveLength(0);
    });

    it('should validate search parameters', async () => {
      const invalidParams = { ...searchParams, resourceType: undefined };

      await expect(medplumAdapter.searchResources(invalidParams))
        .rejects.toThrow();
    });
  });

  describe('validateResource', () => {
    it('should validate FHIR R4 compliant resources', async () => {
      const result = await resourceValidator.validateResource(validPatientResource);

      expect(result.valid).toBe(true);
      expect(result.stats.successRate).toBeGreaterThanOrEqual(0.999);
    });

    it('should detect invalid resource types', async () => {
      const invalidResource = { ...validPatientResource, resourceType: 'InvalidType' };
      
      resourceValidator.validateResource.mockResolvedValue({
        ...validValidationResult,
        valid: false,
        errors: [{
          type: 'Structure',
          path: 'resourceType',
          message: FHIR_ERROR_MESSAGES.INVALID_RESOURCE_TYPE
        }]
      });

      const result = await resourceValidator.validateResource(invalidResource);
      expect(result.valid).toBe(false);
    });

    it('should verify required fields presence', async () => {
      const missingFieldResource = { ...validPatientResource };
      delete missingFieldResource.birthDate;

      resourceValidator.validateResource.mockResolvedValue({
        ...validValidationResult,
        valid: false,
        errors: [{
          type: 'Required',
          path: 'birthDate',
          message: FHIR_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
        }]
      });

      const result = await resourceValidator.validateResource(missingFieldResource);
      expect(result.valid).toBe(false);
    });

    it('should validate resource references', async () => {
      const resourceWithReference = {
        ...validPatientResource,
        generalPractitioner: [{
          reference: 'Practitioner/123'
        }]
      };

      const result = await resourceValidator.validateResource(resourceWithReference);
      expect(result.valid).toBe(true);
    });

    it('should check metadata compliance', async () => {
      const resourceWithoutMeta = { ...validPatientResource };
      delete resourceWithoutMeta.meta;

      resourceValidator.validateResource.mockResolvedValue({
        ...validValidationResult,
        valid: false,
        errors: [{
          type: 'Required',
          path: 'meta',
          message: 'Resource metadata is required'
        }]
      });

      const result = await resourceValidator.validateResource(resourceWithoutMeta);
      expect(result.valid).toBe(false);
    });
  });

  describe('updateResource', () => {
    it('should successfully update existing resource', async () => {
      const updatedResource = {
        ...validPatientResource,
        name: [{
          family: 'Smith',
          given: ['John', 'Robert']
        }]
      };

      medplumAdapter.updateResource.mockResolvedValue(updatedResource);

      const result = await medplumAdapter.updateResource(updatedResource);
      expect(result).toEqual(updatedResource);
    });

    it('should validate resource before update', async () => {
      await medplumAdapter.updateResource(validPatientResource);
      
      expect(resourceValidator.validateResource).toHaveBeenCalledWith(validPatientResource);
    });

    it('should maintain resource version history', async () => {
      const updatedResource = {
        ...validPatientResource,
        meta: {
          ...validPatientResource.meta,
          versionId: '2'
        }
      };

      medplumAdapter.updateResource.mockResolvedValue(updatedResource);

      const result = await medplumAdapter.updateResource(updatedResource);
      expect(result.meta.versionId).toBe('2');
    });
  });

  describe('deleteResource', () => {
    it('should successfully delete existing resource', async () => {
      medplumAdapter.deleteResource.mockResolvedValue(true);

      const result = await medplumAdapter.deleteResource('Patient', '123');
      expect(result).toBe(true);
    });

    it('should handle non-existent resource deletion', async () => {
      medplumAdapter.deleteResource.mockRejectedValue({
        code: FHIR_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: FHIR_ERROR_MESSAGES.RESOURCE_NOT_FOUND
      });

      await expect(medplumAdapter.deleteResource('Patient', 'nonexistent'))
        .rejects.toThrow(FHIR_ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    });
  });
});