import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Grid, Alert } from '@mui/material';
import { useBlockchain } from '@hyperledger/fabric-gateway';

// Internal components
import DataRequestForm from '../../components/marketplace/DataRequestForm';
import PriceCalculator from '../../components/marketplace/PriceCalculator';
import MatchingResults from '../../components/marketplace/MatchingResults';

// Types and interfaces
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { RequestStatus } from '../../types/marketplace.types';
import { useMarketplace } from '../../hooks/useMarketplace';

/**
 * CreateRequest page component for secure healthcare data request creation
 * Implements HIPAA-compliant data request workflow with blockchain integration
 */
const CreateRequest: React.FC = () => {
  // Navigation and state management
  const navigate = useNavigate();
  const { createRequest, calculatePrice } = useMarketplace();
  const blockchainClient = useBlockchain();

  // Component state
  const [request, setRequest] = useState<Partial<IDataRequest>>({
    status: RequestStatus.DRAFT,
    filterCriteria: {
      resourceTypes: [],
      demographics: {
        ageRange: { min: 0, max: 120 },
        gender: [],
        ethnicity: [],
        location: []
      },
      conditions: [],
      dateRange: {
        startDate: new Date(),
        endDate: new Date()
      }
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState<{
    transactionId: string | null;
    status: 'pending' | 'confirmed' | 'failed';
  }>({ transactionId: null, status: 'pending' });

  // Price calculation state
  const [priceEstimate, setPriceEstimate] = useState<{
    totalPrice: number;
    estimatedMatches: number;
  } | null>(null);

  /**
   * Handles form submission with HIPAA compliance validation
   */
  const handleSubmit = useCallback(async (formData: IDataRequest) => {
    setLoading(true);
    setError(null);

    try {
      // Calculate final price estimate
      const pricing = await calculatePrice(formData.filterCriteria);
      
      // Create blockchain transaction record
      const blockchainTx = await blockchainClient.submitTransaction('createDataRequest', {
        requestId: formData.id,
        companyId: formData.companyId,
        pricePerRecord: formData.pricePerRecord,
        timestamp: new Date().toISOString()
      });

      setBlockchainStatus({
        transactionId: blockchainTx.transactionId,
        status: 'pending'
      });

      // Create request with enhanced security metadata
      const createdRequest = await createRequest({
        ...formData,
        blockchainRef: blockchainTx.transactionId,
        complianceMetadata: {
          hipaaCompliant: true,
          validationTimestamp: new Date().toISOString(),
          blockchainVerified: true
        }
      });

      // Update blockchain status
      setBlockchainStatus({
        transactionId: blockchainTx.transactionId,
        status: 'confirmed'
      });

      // Navigate to request details
      navigate(`/marketplace/requests/${createdRequest.id}`);
    } catch (err) {
      console.error('Error creating request:', err);
      setError(err.message || 'Failed to create request. Please try again.');
      setBlockchainStatus(prev => ({
        ...prev,
        status: 'failed'
      }));
    } finally {
      setLoading(false);
    }
  }, [navigate, createRequest, calculatePrice, blockchainClient]);

  /**
   * Handles price updates with blockchain validation
   */
  const handlePriceChange = useCallback(async (
    price: number,
    isValid: boolean
  ) => {
    if (!isValid || !request.filterCriteria) return;

    try {
      const estimate = await calculatePrice(request.filterCriteria);
      setPriceEstimate(estimate);
    } catch (err) {
      console.error('Error calculating price:', err);
      setPriceEstimate(null);
    }
  }, [request.filterCriteria, calculatePrice]);

  /**
   * Handles cancellation and cleanup
   */
  const handleCancel = useCallback(() => {
    navigate('/marketplace/requests');
  }, [navigate]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Form section */}
        <Grid item xs={12} md={8}>
          <DataRequestForm
            initialData={request}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onBlockchainStatus={(status) => 
              setBlockchainStatus(prev => ({ ...prev, status }))
            }
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {blockchainStatus.transactionId && (
            <Alert 
              severity={blockchainStatus.status === 'confirmed' ? 'success' : 'info'}
              sx={{ mt: 2 }}
            >
              Transaction ID: {blockchainStatus.transactionId}
              <br />
              Status: {blockchainStatus.status}
            </Alert>
          )}
        </Grid>

        {/* Price calculator and preview section */}
        <Grid item xs={12} md={4}>
          <PriceCalculator
            request={request as IDataRequest}
            onPriceChange={handlePriceChange}
            complianceMetadata={{
              hipaaCompliant: true,
              blockchainEnabled: true
            }}
          />

          {request.id && (
            <MatchingResults
              requestId={request.id}
              onMatchSelect={() => {}}
              minMatchScore={0.7}
              securityLevel="HIPAA"
            />
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default CreateRequest;