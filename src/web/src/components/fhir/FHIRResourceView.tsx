import React, { memo, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, Typography, CircularProgress, Alert, Tooltip, IconButton } from '@mui/material';
import { CheckCircle, Error, Refresh } from '@mui/icons-material';
import { IFHIRResource, IFHIRValidationResult, FHIRSummaryType } from '../../interfaces/fhir.interface';
import { formatFHIRResource } from '../../utils/fhir.util';
import { useFHIR } from '../../hooks/useFHIR';

// Interface for component display configuration
interface FHIRDisplayConfig {
  showMetadata?: boolean;
  showValidationStatus?: boolean;
  enableRefresh?: boolean;
  refreshInterval?: number;
  maxHeight?: string;
  expandedView?: boolean;
}

// Props interface for the component
interface FHIRResourceViewProps {
  resourceId: string;
  resourceType: string;
  onError?: (error: Error) => void;
  onValidationComplete?: (isValid: boolean) => void;
  displayConfig?: FHIRDisplayConfig;
  refreshInterval?: number;
}

// Styles object for the component
const styles = {
  resourceCard: {
    margin: '16px',
    padding: '16px',
    maxHeight: '600px',
    overflow: 'auto'
  },
  resourceHeader: {
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resourceContent: {
    marginTop: '8px',
    position: 'relative' as const
  },
  errorAlert: {
    marginBottom: '16px',
    width: '100%'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '24px',
    minHeight: '200px',
    alignItems: 'center'
  },
  validationIndicator: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px'
  }
};

/**
 * Enhanced FHIR resource display component with validation and accessibility support
 */
const FHIRResourceView: React.FC<FHIRResourceViewProps> = memo(({
  resourceId,
  resourceType,
  onError,
  onValidationComplete,
  displayConfig = {
    showMetadata: true,
    showValidationStatus: true,
    enableRefresh: true,
    maxHeight: '600px',
    expandedView: false
  },
  refreshInterval
}) => {
  // Initialize FHIR hook with metrics enabled
  const { 
    resources,
    loading,
    error,
    metrics,
    validateResource,
    searchResources,
    clearCache
  } = useFHIR({ enableMetrics: true });

  // Memoized resource search parameters
  const searchParams = useMemo(() => ({
    resourceType,
    filters: [{ field: 'id', operator: 'eq' as const, value: resourceId }],
    pagination: { _count: 1 },
    includes: [],
    sort: [],
    summary: FHIRSummaryType.False
  }), [resourceId, resourceType]);

  // Memoized current resource
  const currentResource = useMemo(() => 
    resources.find(r => r.id === resourceId),
    [resources, resourceId]
  );

  // Validation state
  const [validationResult, setValidationResult] = React.useState<IFHIRValidationResult | null>(null);

  // Handle resource validation
  const handleValidation = useCallback(async (resource: IFHIRResource) => {
    try {
      const result = await validateResource(resource);
      setValidationResult(result);
      onValidationComplete?.(result.valid);
      return result;
    } catch (err) {
      onError?.(err as Error);
      return null;
    }
  }, [validateResource, onValidationComplete, onError]);

  // Fetch resource data
  const fetchResource = useCallback(async () => {
    try {
      await searchResources(searchParams);
    } catch (err) {
      onError?.(err as Error);
    }
  }, [searchResources, searchParams, onError]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    clearCache();
    fetchResource();
  }, [clearCache, fetchResource]);

  // Setup automatic refresh if configured
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(handleRefresh, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, handleRefresh]);

  // Initial fetch and validation
  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  useEffect(() => {
    if (currentResource) {
      handleValidation(currentResource);
    }
  }, [currentResource, handleValidation]);

  // Render loading state
  if (loading) {
    return (
      <div style={styles.loadingContainer} role="status" aria-label="Loading resource">
        <CircularProgress aria-hidden="true" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        style={styles.errorAlert}
        role="alert"
      >
        {error.message}
      </Alert>
    );
  }

  // Render empty state
  if (!currentResource) {
    return (
      <Alert 
        severity="info" 
        style={styles.errorAlert}
        role="status"
      >
        No resource found with ID: {resourceId}
      </Alert>
    );
  }

  // Format resource for display
  const formattedResource = formatFHIRResource(currentResource, {
    sortArrays: true,
    removeEmpty: true
  });

  return (
    <Card 
      style={styles.resourceCard}
      aria-label={`FHIR ${resourceType} Resource View`}
    >
      <CardHeader
        title={
          <div style={styles.resourceHeader}>
            <Typography variant="h6" component="h2">
              {resourceType} - {resourceId}
            </Typography>
            {displayConfig.enableRefresh && (
              <Tooltip title="Refresh resource">
                <IconButton 
                  onClick={handleRefresh}
                  aria-label="Refresh resource"
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            )}
          </div>
        }
      />
      <CardContent>
        {displayConfig.showValidationStatus && validationResult && (
          <Tooltip 
            title={validationResult.valid ? 'Resource is valid' : `${validationResult.errors.length} validation errors`}
          >
            <div style={styles.validationIndicator}>
              {validationResult.valid ? (
                <CheckCircle color="success" aria-label="Valid resource" />
              ) : (
                <Error color="error" aria-label="Invalid resource" />
              )}
            </div>
          </Tooltip>
        )}
        
        <div style={styles.resourceContent}>
          {displayConfig.showMetadata && (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Last Updated: {formattedResource.meta?.lastUpdated || 'N/A'}
              {formattedResource.meta?.versionId && ` | Version: ${formattedResource.meta.versionId}`}
            </Typography>
          )}
          
          <pre style={{ 
            overflow: 'auto',
            maxHeight: displayConfig.maxHeight
          }}>
            <code>
              {JSON.stringify(formattedResource, null, 2)}
            </code>
          </pre>
        </div>

        {metrics && displayConfig.showMetadata && (
          <Typography variant="caption" color="textSecondary">
            Validation Success Rate: {metrics.validationSuccessRate.toFixed(1)}% | 
            Response Time: {metrics.averageResponseTime.toFixed(0)}ms
          </Typography>
        )}
      </CardContent>
    </Card>
  );
});

FHIRResourceView.displayName = 'FHIRResourceView';

export default FHIRResourceView;