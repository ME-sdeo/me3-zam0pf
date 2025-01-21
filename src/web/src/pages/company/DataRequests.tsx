import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  Divider,
  useTheme
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import DataRequestList from '../../components/marketplace/DataRequestList';
import DataRequestForm from '../../components/marketplace/DataRequestForm';
import useMarketplace from '../../hooks/useMarketplace';
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { RequestStatus } from '../../types/marketplace.types';
import Button from '../../components/common/Button';

/**
 * Enhanced DataRequests page component implementing HIPAA-compliant data request management
 * with blockchain transaction tracking and real-time updates
 */
const DataRequests: React.FC = () => {
  const theme = useTheme();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<IDataRequest | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState<string | null>(null);

  // Initialize marketplace hook with blockchain support
  const {
    error,
    complianceStatus,
    createRequest,
    loadRequests
  } = useMarketplace();

  // Load initial requests
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle request creation with HIPAA compliance
  const handleCreateRequest = useCallback(async (requestData: IDataRequest) => {
    try {
      const createdRequest = await createRequest(requestData);
      setBlockchainStatus('PENDING');
      setIsCreateModalOpen(false);
      
      // Audit logging for HIPAA compliance
      console.info('Data request created:', {
        requestId: createdRequest.id,
        timestamp: new Date().toISOString(),
        hipaaCompliant: complianceStatus.hipaaCompliant
      });
    } catch (error) {
      console.error('Error creating request:', error);
      setBlockchainStatus('FAILED');
    }
  }, [createRequest, complianceStatus]);

  // Handle request selection for viewing/editing
  const handleRequestSelect = useCallback((request: IDataRequest) => {
    setSelectedRequest(request);
    setIsEditModalOpen(true);
  }, []);

  // Handle request status changes
  const handleStatusChange = useCallback(async (requestId: string, newStatus: RequestStatus) => {
    try {
      // Implementation would go here
      console.info('Status change:', { requestId, newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          An error occurred while loading the data requests.
        </Alert>
      }
    >
      <Box sx={{ p: theme.spacing(3) }}>
        {/* Header Section */}
        <Grid container justifyContent="space-between" alignItems="center" mb={3}>
          <Grid item>
            <Typography variant="h1" sx={{ fontSize: '2rem', fontWeight: 500 }}>
              Data Requests
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              medicalEnvironment={true}
              aria-label="Create New Request"
            >
              Create Request
            </Button>
          </Grid>
        </Grid>

        {/* Compliance Status */}
        {!complianceStatus.hipaaCompliant && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Compliance Warning</AlertTitle>
            Some requests may not meet HIPAA compliance requirements.
            Please review and update as needed.
          </Alert>
        )}

        {/* Blockchain Status */}
        {blockchainStatus && (
          <Alert 
            severity={blockchainStatus === 'PENDING' ? 'info' : 'error'}
            sx={{ mb: 2 }}
          >
            <AlertTitle>Blockchain Status</AlertTitle>
            {blockchainStatus === 'PENDING' 
              ? 'Transaction is being processed on the blockchain...'
              : 'Blockchain transaction failed. Please try again.'}
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error.message}
          </Alert>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Data Request List */}
        <DataRequestList
          onRequestSelect={handleRequestSelect}
          onStatusChange={handleStatusChange}
          enableRealtime={true}
        />

        {/* Create Request Modal */}
        {isCreateModalOpen && (
          <DataRequestForm
            onSubmit={handleCreateRequest}
            onCancel={() => setIsCreateModalOpen(false)}
            onBlockchainStatus={setBlockchainStatus}
          />
        )}

        {/* Edit Request Modal */}
        {isEditModalOpen && selectedRequest && (
          <DataRequestForm
            initialData={selectedRequest}
            onSubmit={handleCreateRequest}
            onCancel={() => setIsEditModalOpen(false)}
            onBlockchainStatus={setBlockchainStatus}
          />
        )}
      </Box>
    </ErrorBoundary>
  );
};

export default DataRequests;