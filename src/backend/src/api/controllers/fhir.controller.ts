import { Request, Response } from 'express'; // ^4.18.0
import { injectable } from 'inversify'; // ^6.0.1
import { Logger } from 'winston'; // ^3.8.0
import { MetricsService } from '@myelixir/metrics'; // ^1.0.0
import { AuditService } from '@myelixir/audit'; // ^1.0.0
import { FHIRService } from '../../fhir/services/fhir.service';
import {
  FHIRResource,
  FHIRValidationResult,
  FHIR_VERSION,
  FHIR_VALIDATION_THRESHOLD,
  FHIRSearchParams
} from '../../interfaces/fhir.interface';

/**
 * Enhanced controller handling FHIR resource operations with comprehensive
 * validation, security, and monitoring capabilities
 */
@injectable()
export class FHIRController {
  constructor(
    private readonly fhirService: FHIRService,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditService,
    private readonly logger: Logger
  ) {}

  /**
   * Creates a new FHIR resource with validation and monitoring
   */
  async createResource(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      // Extract and validate request body
      const resource: FHIRResource = req.body;
      if (!resource || !resource.resourceType) {
        return res.status(400).json({
          error: 'Invalid request body - missing required FHIR resource structure'
        });
      }

      // Track operation metrics
      const operationId = `create_${resource.resourceType}`;
      this.metricsService.startOperation(operationId);

      // Create resource
      const createdResource = await this.fhirService.createFHIRResource(resource);

      // Track validation metrics
      await this.fhirService.trackValidationMetrics(resource.resourceType);

      // Log successful creation
      this.logger.info('FHIR resource created', {
        resourceType: resource.resourceType,
        id: createdResource.id,
        duration: Date.now() - startTime
      });

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      return res.status(201).json(createdResource);
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('create_resource', false);

      this.logger.error('Error creating FHIR resource:', error);
      return res.status(500).json({
        error: 'Internal server error during resource creation'
      });
    }
  }

  /**
   * Retrieves a FHIR resource by type and ID
   */
  async getResource(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { resourceType, id } = req.params;

      // Validate required parameters
      if (!resourceType || !id) {
        return res.status(400).json({
          error: 'Missing required parameters: resourceType and id'
        });
      }

      // Track operation metrics
      const operationId = `get_${resourceType}`;
      this.metricsService.startOperation(operationId);

      // Retrieve resource
      const resource = await this.fhirService.getFHIRResource(resourceType, id);

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      this.logger.info('FHIR resource retrieved', {
        resourceType,
        id,
        duration: Date.now() - startTime
      });

      return res.status(200).json(resource);
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('get_resource', false);

      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      this.logger.error('Error retrieving FHIR resource:', error);
      return res.status(500).json({
        error: 'Internal server error during resource retrieval'
      });
    }
  }

  /**
   * Updates an existing FHIR resource
   */
  async updateResource(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { resourceType, id } = req.params;
      const resource: FHIRResource = req.body;

      // Validate request
      if (!resource || resource.id !== id || resource.resourceType !== resourceType) {
        return res.status(400).json({
          error: 'Invalid request - resource ID/type mismatch or missing data'
        });
      }

      // Track operation metrics
      const operationId = `update_${resourceType}`;
      this.metricsService.startOperation(operationId);

      // Update resource
      const updatedResource = await this.fhirService.updateFHIRResource(resource);

      // Track validation metrics
      await this.fhirService.trackValidationMetrics(resourceType);

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      this.logger.info('FHIR resource updated', {
        resourceType,
        id,
        duration: Date.now() - startTime
      });

      return res.status(200).json(updatedResource);
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('update_resource', false);

      this.logger.error('Error updating FHIR resource:', error);
      return res.status(500).json({
        error: 'Internal server error during resource update'
      });
    }
  }

  /**
   * Deletes a FHIR resource
   */
  async deleteResource(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const { resourceType, id } = req.params;

      // Validate required parameters
      if (!resourceType || !id) {
        return res.status(400).json({
          error: 'Missing required parameters: resourceType and id'
        });
      }

      // Track operation metrics
      const operationId = `delete_${resourceType}`;
      this.metricsService.startOperation(operationId);

      // Delete resource
      await this.fhirService.deleteFHIRResource(resourceType, id);

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      this.logger.info('FHIR resource deleted', {
        resourceType,
        id,
        duration: Date.now() - startTime
      });

      return res.status(204).send();
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('delete_resource', false);

      this.logger.error('Error deleting FHIR resource:', error);
      return res.status(500).json({
        error: 'Internal server error during resource deletion'
      });
    }
  }

  /**
   * Searches for FHIR resources based on criteria
   */
  async searchResources(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const searchParams: FHIRSearchParams = req.body;

      // Validate search parameters
      if (!searchParams.resourceType || !searchParams.filters) {
        return res.status(400).json({
          error: 'Invalid search parameters - missing required fields'
        });
      }

      // Track operation metrics
      const operationId = `search_${searchParams.resourceType}`;
      this.metricsService.startOperation(operationId);

      // Perform search
      const results = await this.fhirService.searchFHIRResources(searchParams);

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      this.logger.info('FHIR resource search completed', {
        resourceType: searchParams.resourceType,
        filterCount: searchParams.filters.length,
        resultCount: results.length,
        duration: Date.now() - startTime
      });

      return res.status(200).json(results);
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('search_resources', false);

      this.logger.error('Error searching FHIR resources:', error);
      return res.status(500).json({
        error: 'Internal server error during resource search'
      });
    }
  }

  /**
   * Validates a FHIR resource structure
   */
  async validateResource(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    try {
      const resource: FHIRResource = req.body;

      // Validate request body
      if (!resource || !resource.resourceType) {
        return res.status(400).json({
          error: 'Invalid request body - missing required FHIR resource structure'
        });
      }

      // Track operation metrics
      const operationId = `validate_${resource.resourceType}`;
      this.metricsService.startOperation(operationId);

      // Validate resource
      const validationResult = await this.fhirService.validateFHIRResource(resource);

      // Track operation completion
      this.metricsService.endOperation(operationId, true);

      this.logger.info('FHIR resource validation completed', {
        resourceType: resource.resourceType,
        valid: validationResult.valid,
        errorCount: validationResult.stats.errorCount,
        duration: Date.now() - startTime
      });

      return res.status(200).json(validationResult);
    } catch (error) {
      // Track operation failure
      this.metricsService.endOperation('validate_resource', false);

      this.logger.error('Error validating FHIR resource:', error);
      return res.status(500).json({
        error: 'Internal server error during resource validation'
      });
    }
  }
}