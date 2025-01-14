import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress, Divider } from '@mui/material';
import FHIRResourceView from '../../components/fhir/FHIRResourceView';
import FHIRUploader from '../../components/fhir/FHIRUploader';
import FHIRValidator from '../../components/fhir/FHIRValidator';
import { useFHIR } from '../../hooks/useFHIR';
import { IFHIRResource, IFHIRValidationResult, IFHIRValidationError } from '../../interfaces/fhir.interface';
import { FHIR_VALIDATION_RULES } from '../../constants/fhir.constants';

interface HealthRecordsState {
  resources: IFHIRResource[];
  selectedResource: IFHIRResource | null;
  uploadProgress: number;
  validationStatus: IFHIRValidationResult | null;
  error: {
    message: string;
    details?: string;
    timestamp: Date;
  } | null;
}

const HealthRecords: React.FC = () => {
  // State management using the defined interface
  const [state, setState] = useState<HealthRecordsState>({
    resources: [],
    selectedResource: null,
    uploadProgress: 0,
    validationStatus: null,
    error: null
  });

  // Initialize FHIR hook with metrics enabled
  const { 
    resources,
    loading,
    error,
    metrics,
    uploadResource,
    validateResource,
    searchResources
  } = useFHIR({ 
    enableMetrics: true,
    strictValidation: true
  });

  // Load initial resources
  useEffect(() => {
    const fetchResources = async () => {
      try {
        await searchResources({
          resourceType: 'Patient',
          filters: [],
          pagination: { _count: 10 },
          includes: [],
          sort: [{ field: 'lastUpdated', order: 'desc' }],
          summary: 'false'
        });
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: {
            message: 'Failed to load health records',
            details: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date()
          }
        }));
      }
    };

    fetchResources();
  }, [searchResources]);

  // Update resources when FHIR hook data changes
  useEffect(() => {
    setState(prev => ({ ...prev, resources }));
  }, [resources]);

  // Handle successful upload completion
  const handleUploadComplete = useCallback(async (resource: IFHIRResource) => {
    try {
      // Validate the uploaded resource
      const validationResult = await validateResource(resource);
      
      if (validationResult.valid) {
        // Upload the validated resource
        const uploadedResource = await uploadResource(resource);
        
        setState(prev => ({
          ...prev,
          resources: [uploadedResource, ...prev.resources],
          selectedResource: uploadedResource,
          validationStatus: validationResult,
          uploadProgress: 100,
          error: null
        }));
      } else {
        throw new Error('Resource validation failed');
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: {
          message: 'Failed to process uploaded resource',
          details: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date()
        },
        uploadProgress: 0
      }));
    }
  }, [validateResource, uploadResource]);

  // Handle upload errors
  const handleUploadError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error: {
        message: 'Failed to upload health record',
        details: error.message,
        timestamp: new Date()
      },
      uploadProgress: 0
    }));
  }, []);

  // Handle validation errors
  const handleValidationError = useCallback((errors: IFHIRValidationError[]) => {
    setState(prev => ({
      ...prev,
      validationStatus: {
        valid: false,
        errors,
        warnings: [],
        processingTime: 0,
        resourceCount: 1
      }
    }));
  }, []);

  // Handle audit events
  const handleAuditEvent = useCallback((event: any) => {
    console.info('Health Records Audit Event:', {
      ...event,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Handle resource selection
  const handleResourceSelect = useCallback((resource: IFHIRResource) => {
    setState(prev => ({
      ...prev,
      selectedResource: resource
    }));
  }, []);

  return (
    <Box component="main" role="main" aria-label="Health Records Management">
      <Typography variant="h4" component="h1" gutterBottom>
        Health Records
      </Typography>

      <Grid container spacing={3}>
        {/* Upload Section */}
        <Grid item xs={12}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Health Record
            </Typography>
            <FHIRUploader
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              onValidationError={handleValidationError}
              onAuditEvent={handleAuditEvent}
              maxFileSize={FHIR_VALIDATION_RULES.MAX_RESOURCE_SIZE}
              allowedMimeTypes={FHIR_VALIDATION_RULES.SUPPORTED_FORMATS.map(format => `.${format}`)}
              accessibilityLabels={{
                dropzone: 'Drop FHIR resource files here or click to select',
                uploading: 'Uploading and validating FHIR resource',
                error: 'Error uploading FHIR resource'
              }}
            />
          </Paper>
        </Grid>

        {/* Resources List */}
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Health Records
            </Typography>
            
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : state.resources.length > 0 ? (
              <Box>
                {state.resources.map((resource) => (
                  <Box
                    key={resource.id}
                    onClick={() => handleResourceSelect(resource)}
                    sx={{
                      cursor: 'pointer',
                      p: 2,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-selected={state.selectedResource?.id === resource.id}
                  >
                    <Typography variant="subtitle1">
                      {resource.resourceType} - {resource.id}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Last Updated: {new Date(resource.meta.lastUpdated).toLocaleString()}
                    </Typography>
                    <Divider sx={{ mt: 2 }} />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="textSecondary">
                No health records found. Upload your first record above.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Resource Detail View */}
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Record Details
            </Typography>
            
            {state.selectedResource ? (
              <>
                <FHIRResourceView
                  resourceId={state.selectedResource.id}
                  resourceType={state.selectedResource.resourceType}
                  displayConfig={{
                    showMetadata: true,
                    showValidationStatus: true,
                    enableRefresh: true,
                    maxHeight: '500px',
                    expandedView: false
                  }}
                />
                <Box mt={3}>
                  <FHIRValidator
                    resource={state.selectedResource}
                    onValidationComplete={(result) => {
                      setState(prev => ({ ...prev, validationStatus: result }));
                    }}
                    autoValidate={true}
                  />
                </Box>
              </>
            ) : (
              <Typography color="textSecondary">
                Select a health record to view details
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Performance Metrics */}
      {metrics && (
        <Box mt={3}>
          <Typography variant="caption" color="textSecondary">
            Validation Success Rate: {metrics.validationSuccessRate.toFixed(1)}% |
            Average Response Time: {metrics.averageResponseTime.toFixed(0)}ms |
            Cache Hit Rate: {metrics.cacheHitRate.toFixed(1)}%
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HealthRecords;