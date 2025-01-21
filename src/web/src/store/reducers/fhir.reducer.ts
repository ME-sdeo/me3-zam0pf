import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IFHIRResource } from '../../interfaces/fhir.interface';
import { 
  uploadFHIRResourceThunk,
  searchFHIRResourcesThunk,
  getFHIRResourceThunk
} from '../actions/fhir.actions';

/**
 * Interface defining the shape of the FHIR state slice
 */
interface IFHIRState {
  resources: IFHIRResource[];
  selectedResource: IFHIRResource | null;
  loading: boolean;
  error: string | null;
  validationResult: {
    valid: boolean;
    errors: IFHIRValidationError[];
    warnings: IFHIRValidationError[];
  } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  searchCriteria: {
    resourceType?: string;
    query?: string;
  };
  validationStats: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Initial state for the FHIR reducer
 */
const initialState: IFHIRState = {
  resources: [],
  selectedResource: null,
  loading: false,
  error: null,
  validationResult: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  },
  searchCriteria: {},
  validationStats: {
    total: 0,
    successful: 0,
    failed: 0
  }
};

/**
 * FHIR slice with comprehensive state management
 */
const fhirSlice = createSlice({
  name: 'fhir',
  initialState,
  reducers: {
    setSelectedResource: (state, action: PayloadAction<IFHIRResource | null>) => {
      state.selectedResource = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateValidationStats: (state, action: PayloadAction<{ success: boolean }>) => {
      state.validationStats.total += 1;
      if (action.payload.success) {
        state.validationStats.successful += 1;
      } else {
        state.validationStats.failed += 1;
      }
    },
    setPagination: (state, action: PayloadAction<Partial<IFHIRState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setSearchCriteria: (state, action: PayloadAction<IFHIRState['searchCriteria']>) => {
      state.searchCriteria = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Upload FHIR Resource
    builder.addCase(uploadFHIRResourceThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(uploadFHIRResourceThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.resources = [...state.resources, action.payload.resource];
      state.validationResult = action.payload.validation;
      state.validationStats.total += 1;
      state.validationStats.successful += 1;
    });
    builder.addCase(uploadFHIRResourceThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.error || 'Upload failed';
      state.validationStats.total += 1;
      state.validationStats.failed += 1;
    });

    // Search FHIR Resources
    builder.addCase(searchFHIRResourcesThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchFHIRResourcesThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.resources = action.payload.resources;
      state.pagination.total = action.payload.totalCount;
      state.error = null;
    });
    builder.addCase(searchFHIRResourcesThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.error || 'Search failed';
      state.resources = [];
    });

    // Get FHIR Resource
    builder.addCase(getFHIRResourceThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getFHIRResourceThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedResource = action.payload.resource;
      state.error = null;
    });
    builder.addCase(getFHIRResourceThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.error || 'Resource retrieval failed';
      state.selectedResource = null;
    });
  }
});

// Export actions
export const { 
  setSelectedResource,
  clearError,
  updateValidationStats,
  setPagination,
  setSearchCriteria
} = fhirSlice.actions;

// Export reducer
export default fhirSlice.reducer;