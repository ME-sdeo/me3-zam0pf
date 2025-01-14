import { describe, it, beforeEach, afterEach, expect } from 'jest'; // ^29.0.0
import { Container } from 'inversify'; // ^6.0.1
import { FHIRService } from '../../src/fhir/services/fhir.service';
import { FHIRResource, FHIRValidationResult, FHIR_VALIDATION_THRESHOLD } from '../../src/interfaces/fhir.interface';

// Test timeout for FHIR operations
const TEST_TIMEOUT = 30000;

// Mock FHIR resources for testing
const MOCK_PATIENT_RESOURCE: FHIRResource = {
  resourceType: 'Patient',
  id: 'test-patient',
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
    security: [{ system: 'https://myelixir.com/security', code: 'encrypted' }]
  },
  identifier: [{
    system: 'https://myelixir.com/patient-id',
    value: 'TEST-12345'
  }],
  name: [{
    family: 'Doe',
    given: ['John']
  }],
  telecom: [{
    system: 'phone',
    value: '+1-555-555-0123'
  }],
  address: [{
    line: ['123 Test St'],
    city: 'Test City',
    state: 'TS',
    postalCode: '12345'
  }]
};

const MOCK_OBSERVATION_RESOURCE: FHIRResource = {
  resourceType: 'Observation',
  id: 'test-observation',
  meta: {
    versionId: '1',
    lastUpdated: new Date().toISOString(),
    security: [{ system: 'https://myelixir.com/security', code: 'encrypted' }]
  },
  status: 'final',
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '8480-6',
      display: 'Systolic blood pressure'
    }]
  },
  subject: {
    reference: 'Patient/test-patient'
  },
  valueQuantity: {
    value: 120,
    unit: 'mmHg',
    system: 'http://unitsofmeasure.org',
    code: 'mm[Hg]'
  }
};

describe('FHIR Service Integration Tests', () => {
  let container: Container;
  let fhirService: FHIRService;
  let testResources: FHIRResource[] = [];

  beforeEach(async () => {
    // Set up test container with required dependencies
    container = new Container();
    container.bind(FHIRService).toSelf();
    
    // Initialize FHIR service
    fhirService = container.get(FHIRService);
    
    // Clear test resources array
    testResources = [];
  }, TEST_TIMEOUT);

  afterEach(async () => {
    // Clean up test resources
    for (const resource of testResources) {
      await fhirService.deleteFHIRResource(resource.resourceType, resource.id);
    }
  }, TEST_TIMEOUT);

  describe('CRUD Operations', () => {
    it('should create a new Patient resource with encryption', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      expect(createdResource.id).toBeDefined();
      expect(createdResource.meta.security).toContainEqual(
        expect.objectContaining({ code: 'encrypted' })
      );

      // Verify encryption
      const encryptionVerified = await fhirService.verifyEncryption(createdResource);
      expect(encryptionVerified).toBe(true);
    }, TEST_TIMEOUT);

    it('should retrieve and decrypt a Patient resource', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      const retrievedResource = await fhirService.getFHIRResource('Patient', createdResource.id);
      expect(retrievedResource.name[0].family).toBe('Doe');
      expect(retrievedResource.telecom[0].value).toBe('+1-555-555-0123');
    }, TEST_TIMEOUT);

    it('should update a Patient resource maintaining encryption', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      const updateData = {
        ...createdResource,
        name: [{
          family: 'Doe',
          given: ['Jane']
        }]
      };

      const updatedResource = await fhirService.updateFHIRResource(updateData);
      expect(updatedResource.name[0].given[0]).toBe('Jane');
      
      // Verify encryption maintained
      const encryptionVerified = await fhirService.verifyEncryption(updatedResource);
      expect(encryptionVerified).toBe(true);
    }, TEST_TIMEOUT);

    it('should delete a Patient resource and verify audit log', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      await fhirService.deleteFHIRResource('Patient', createdResource.id);
      
      // Verify audit log entry
      const auditLog = await fhirService.checkAuditLog('Patient', createdResource.id, 'delete');
      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('delete');
    }, TEST_TIMEOUT);
  });

  describe('Security Controls', () => {
    it('should maintain field-level encryption across operations', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      // Verify sensitive fields are encrypted
      const sensitiveFields = ['identifier', 'name', 'telecom', 'address'];
      for (const field of sensitiveFields) {
        const isEncrypted = await fhirService.verifyEncryption(createdResource, field);
        expect(isEncrypted).toBe(true);
      }
    }, TEST_TIMEOUT);

    it('should generate comprehensive audit logs for all operations', async () => {
      const createdResource = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(createdResource);

      // Verify audit logs for create
      const createLog = await fhirService.checkAuditLog('Patient', createdResource.id, 'create');
      expect(createLog).toBeDefined();

      // Update resource
      await fhirService.updateFHIRResource(createdResource);
      const updateLog = await fhirService.checkAuditLog('Patient', createdResource.id, 'update');
      expect(updateLog).toBeDefined();

      // Access resource
      await fhirService.getFHIRResource('Patient', createdResource.id);
      const accessLog = await fhirService.checkAuditLog('Patient', createdResource.id, 'read');
      expect(accessLog).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Validation and Data Quality', () => {
    it('should maintain 99.9% validation success rate', async () => {
      // Create multiple test resources
      const resources = [MOCK_PATIENT_RESOURCE, MOCK_OBSERVATION_RESOURCE];
      for (const resource of resources) {
        const created = await fhirService.createFHIRResource(resource);
        testResources.push(created);
      }

      // Get validation metrics
      const metrics = await fhirService.getValidationMetrics();
      expect(metrics.successRate).toBeGreaterThanOrEqual(FHIR_VALIDATION_THRESHOLD);
    }, TEST_TIMEOUT);

    it('should validate FHIR resources against R4 schema', async () => {
      const validationResult = await fhirService.validateFHIRResource(MOCK_PATIENT_RESOURCE);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    }, TEST_TIMEOUT);

    it('should reject invalid FHIR resources', async () => {
      const invalidResource = {
        ...MOCK_PATIENT_RESOURCE,
        resourceType: 'Patient',
        // Missing required 'id' field
        meta: {}
      };

      await expect(fhirService.createFHIRResource(invalidResource))
        .rejects
        .toThrow('Resource validation failed');
    }, TEST_TIMEOUT);
  });

  describe('Related Resources', () => {
    it('should maintain referential integrity for related resources', async () => {
      // Create patient first
      const patient = await fhirService.createFHIRResource(MOCK_PATIENT_RESOURCE);
      testResources.push(patient);

      // Create observation with reference to patient
      const observation = {
        ...MOCK_OBSERVATION_RESOURCE,
        subject: {
          reference: `Patient/${patient.id}`
        }
      };
      const createdObservation = await fhirService.createFHIRResource(observation);
      testResources.push(createdObservation);

      // Verify reference
      expect(createdObservation.subject.reference).toBe(`Patient/${patient.id}`);
    }, TEST_TIMEOUT);
  });
});