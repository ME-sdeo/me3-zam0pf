import { createAsyncThunk } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^1.9.0
import { 
  IFHIRResource, 
  IFHIRSearchParams,
  IFHIRValidationResult 
} from '../../interfaces/fhir.interface';
import { 
  uploadFHIRResource,
  searchFHIRResources
} from '../../api/fhir.api';
import { validateFHIRResource } from '../../utils/fhir.util';

// Action type constants
const FHIR_ACTION_PREFIX = 'fhir';

/**
 * Enhanced async thunk for uploading FHIR resources with validation
 * Implements comprehensive error handling and validation metrics tracking
 */
export const uploadFHIRResourceThunk = createAsyncThunk(
  `${FHIR_ACTION_PREFIX}/uploadResource`,
  async (resource: IFHIRResource, { rejectWithValue }) => {
    try {
      // Pre-validate resource before upload
      const validationResult = await validateFHIRResource(resource);
      if (!validationResult.valid) {
        return rejectWithValue({
          error: 'Validation failed',
          details: validationResult.errors,
          resource
        });
      }

      // Upload resource with enhanced error handling
      const uploadedResource = await uploadFHIRResource(resource);
      
      return {
        resource: uploadedResource,
        validation: validationResult,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Upload failed',
        resource
      });
    }
  }
);

/**
 * Enhanced async thunk for searching FHIR resources with caching
 * Implements request deduplication and performance optimization
 */
export const searchFHIRResourcesThunk = createAsyncThunk(
  `${FHIR_ACTION_PREFIX}/searchResources`,
  async (searchParams: IFHIRSearchParams, { rejectWithValue }) => {
    try {
      // Execute search with caching and deduplication
      const resources = await searchFHIRResources(searchParams);

      return {
        resources,
        searchParams,
        timestamp: new Date().toISOString(),
        totalCount: resources.length
      };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Search failed',
        searchParams
      });
    }
  }
);

/**
 * Type definitions for action payloads
 */
export interface UploadFHIRResourcePayload {
  resource: IFHIRResource;
  validation: IFHIRValidationResult;
  timestamp: string;
}

export interface SearchFHIRResourcesPayload {
  resources: IFHIRResource[];
  searchParams: IFHIRSearchParams;
  timestamp: string;
  totalCount: number;
}

export interface GetFHIRResourcePayload {
  resource: IFHIRResource;
  params: {
    resourceType: string;
    id: string;
  };
  timestamp: string;
}

export interface ValidateFHIRResourcePayload {
  resource: IFHIRResource;
  validationResult: IFHIRValidationResult;
  timestamp: string;
  processingTime: number;
}