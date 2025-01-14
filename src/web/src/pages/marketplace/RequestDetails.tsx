import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Security as SecurityIcon,
  Verified as BlockchainIcon,
  Timeline as HistoryIcon,
  MonetizationOn as PriceIcon
} from '@mui/icons-material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { MarketplaceService } from '../../services/marketplace.service';
import MatchingResults from '../../components/marketplace/MatchingResults';
import { RequestStatus } from '../../types/marketplace.types';

// Component Props
interface RequestDetailsProps {
  onStatusChange?: (status: RequestStatus) => void;
  onError?: (error: Error) => void;
}

/**
 * RequestDetails component displays comprehensive information about a healthcare data request
 * Implements HIPAA-compliant data handling with real-time blockchain status
 */
const RequestDetails: React.FC<RequestDetailsProps> = ({
  onStatusChange,
  onError
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // URL parameters
  const { requestId } = useParams<{ requestId: string }>();

  // State management
  const [request, setRequest] = useState<IDataRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState<{
    verified: boolean;
    timestamp: string | null;
  }>({
    verified: false,
    timestamp: null
  });

  /**
   * Fetches request details with blockchain verification
   */
  const fetchRequestDetails = useCallback(async () => {
    if (!requestId) return;

    try {
      setLoading(true);
      const marketplaceService = new MarketplaceService();
      
      // Fetch request details
      const requestData = await marketplaceService.getRequest(requestId);
      setRequest(requestData);

      // Verify blockchain status
      if (requestData.blockchainRef) {
        const status = await marketplaceService.getBlockchainStatus(requestData.blockchainRef);
        setBlockchainStatus({
          verified: status.verified,
          timestamp: status.timestamp
        });
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [requestId, onError]);

  /**
   * Handles request status updates with blockchain tracking
   */
  const handleStatusChange = useCallback(async (newStatus: RequestStatus) => {
    if (!request || !requestId) return;

    try {
      const marketplaceService = new MarketplaceService();
      await marketplaceService.updateRequest(requestId, { status: newStatus });
      
      onStatusChange?.(newStatus);
      await fetchRequestDetails();
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [request, requestId, onStatusChange, fetchRequestDetails, onError]);

  // Initial data load and WebSocket subscription
  useEffect(() => {
    fetchRequestDetails();

    // Set up real-time updates
    const marketplaceService = new MarketplaceService();
    const unsubscribe = marketplaceService.subscribeToUpdates(requestId!, (updatedRequest) => {
      setRequest(updatedRequest);
    });

    return () => {
      unsubscribe();
    };
  }, [requestId, fetchRequestDetails]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error"
        action={
          <Button color="inherit" onClick={fetchRequestDetails}>
            Retry
          </Button>
        }
      >
        {error.message}
      </Alert>
    );
  }

  if (!request) {
    return (
      <Alert severity="warning">
        Request not found or access denied
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          An error occurred while displaying request details
        </Alert>
      }
    >
      <Box sx={{ maxWidth: '1200px', margin: '0 auto', padding: 3 }}>
        {/* Header Section */}
        <Paper elevation={0} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
            <Typography variant="h5" component="h1" gutterBottom>
              Request Details
              <SecurityIcon 
                color="primary" 
                sx={{ ml: 1, verticalAlign: 'middle' }}
                aria-label="HIPAA Compliant"
              />
            </Typography>
            <Chip
              icon={<BlockchainIcon />}
              label={blockchainStatus.verified ? 'Verified' : 'Pending'}
              color={blockchainStatus.verified ? 'success' : 'warning'}
              sx={{ ml: 2 }}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Request Information */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            <Typography variant="body1">
              <strong>Status:</strong>{' '}
              <Chip 
                label={request.status} 
                color={request.status === RequestStatus.ACTIVE ? 'success' : 'default'}
                size="small"
              />
            </Typography>
            <Typography variant="body1">
              <strong>Created:</strong>{' '}
              {new Date(request.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body1">
              <strong>Price per Record:</strong>{' '}
              <PriceIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              ${request.pricePerRecord}
            </Typography>
            <Typography variant="body1">
              <strong>Records Needed:</strong>{' '}
              {request.recordsNeeded}
            </Typography>
          </Box>

          {/* Filter Criteria */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Filter Criteria
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {request.filterCriteria.resourceTypes.map((type, index) => (
                <Chip
                  key={index}
                  label={type}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </Box>

          {/* Blockchain Information */}
          {request.blockchainRef && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Blockchain Reference
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Transaction ID: {request.blockchainRef}
              </Typography>
              {blockchainStatus.timestamp && (
                <Typography variant="body2" color="textSecondary">
                  Last Verified: {new Date(blockchainStatus.timestamp).toLocaleString()}
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Matching Results Section */}
        <Paper elevation={0} sx={{ p: 3 }}>
          <MatchingResults
            requestId={requestId!}
            onMatchSelect={(match) => {
              console.log('Match selected:', match);
            }}
            minMatchScore={0.7}
            securityLevel="HIPAA"
          />
        </Paper>
      </Box>
    </ErrorBoundary>
  );
};

export default RequestDetails;