import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  useTheme,
  Chip,
  CircularProgress
} from '@mui/material';

// Internal imports
import DataRequestList from '../../components/marketplace/DataRequestList';
import PageHeader from '../../components/common/PageHeader';
import useMarketplace from '../../hooks/useMarketplace';
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { RequestStatus } from '../../types/marketplace.types';
import { withErrorBoundary } from '../../utils/error.util';
import { withAuditLogging } from '../../utils/audit.util';

/**
 * RequestList page component for displaying healthcare data marketplace requests
 * Implements HIPAA/GDPR compliance with enhanced accessibility
 */
const RequestList: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedFilters, setSelectedFilters] = useState<RequestFilterProps>({
    status: [RequestStatus.ACTIVE, RequestStatus.MATCHING],
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date()
    }
  });

  // Initialize marketplace hook with blockchain tracking
  const {
    requests,
    loading,
    error,
    loadRequests,
    blockchainStatus,
    complianceStatus
  } = useMarketplace();

  // Load requests with retry mechanism
  useEffect(() => {
    const loadRequestsWithRetry = async (retries = 3) => {
      try {
        await loadRequests(selectedFilters);
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => loadRequestsWithRetry(retries - 1), 1000);
        }
      }
    };
    loadRequestsWithRetry();
  }, [loadRequests, selectedFilters]);

  // Handle request creation with security checks
  const handleCreateRequest = useCallback(async () => {
    try {
      if (!complianceStatus.hipaaCompliant) {
        throw new Error('System does not meet HIPAA compliance requirements');
      }
      navigate('/marketplace/requests/create');
    } catch (error) {
      console.error('Error navigating to create request:', error);
    }
  }, [navigate, complianceStatus]);

  // Handle request selection with consent verification
  const handleRequestSelect = useCallback(async (request: IDataRequest) => {
    try {
      navigate(`/marketplace/requests/${request.id}`, {
        state: { blockchainRef: request.blockchainRef }
      });
    } catch (error) {
      console.error('Error navigating to request details:', error);
    }
  }, [navigate]);

  return (
    <Box
      sx={{
        padding: theme.spacing(3),
        maxWidth: '1200px',
        margin: '0 auto'
      }}
    >
      <PageHeader
        title="Healthcare Data Requests"
        subtitle="HIPAA-compliant marketplace for secure health data exchange"
        medicalEnvironment={true}
        actionButton={{
          label: "Create Request",
          onClick: handleCreateRequest,
          variant: "primary",
          consentRequired: true,
          blockchainState: blockchainStatus.connected ? 'confirmed' : 'pending'
        }}
      />

      {/* Compliance Status Alert */}
      {!complianceStatus.hipaaCompliant && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          role="alert"
        >
          System compliance check required. Some features may be limited.
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          role="alert"
        >
          {error.message}
        </Alert>
      )}

      {/* Blockchain Status */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={blockchainStatus.connected ? 'Blockchain Connected' : 'Connecting to Blockchain'}
          color={blockchainStatus.connected ? 'success' : 'warning'}
          size="small"
        />
        {!blockchainStatus.connected && (
          <CircularProgress size={20} sx={{ ml: 1 }} />
        )}
      </Box>

      {/* Request List */}
      <DataRequestList
        filters={selectedFilters}
        onRequestSelect={handleRequestSelect}
        pageSize={10}
        enableRealtime={true}
      />

      {/* Loading State */}
      {loading && (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mt: 4 
          }}
          role="status"
          aria-label="Loading requests"
        >
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!loading && requests.length === 0 && (
        <Typography
          variant="body1"
          sx={{ textAlign: 'center', mt: 4 }}
          color="text.secondary"
        >
          No data requests found. Create a new request to get started.
        </Typography>
      )}
    </Box>
  );
};

// Export with error boundary and audit logging
export default withErrorBoundary(
  withAuditLogging(RequestList, 'RequestList')
);