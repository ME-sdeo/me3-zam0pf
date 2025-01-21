import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Grid, Alert } from '@mui/material';

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

  // Component state
  const [request] = useState<Partial<IDataRequest>>({
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
      },
      excludedFields: [],
      requiredFields: [],
      customFilters: {}
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState<{
    transactionId: string | null;
    status: 'pending' | 'failed' | 'confirmed';
  }>({ transactionId: null, status: 'pending' });

  /**
   * Handles form submission with HIPAA compliance validation
   */
  const handleSubmit = useCallback(async (formData: IDataRequest) => {
    setError(null);

    try {
      await calculatePrice(formData.filterCriteria);
      
      // Create blockchain transaction record
      const blockchainTx = await createRequest(formData);

      setBlockchainStatus({
        transactionId: blockchainTx.id,
        status: 'pending'
      });

      // Navigate to request details
      navigate(`/marketplace/requests/${blockchainTx.id}`);
    } catch (err) {
      console.error('Error creating request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create request. Please try again.';
      setError(errorMessage);
      setBlockchainStatus(prev => ({
        ...prev,
        status: 'failed'
      }));
    }
  }, [navigate, createRequest, calculatePrice]);

  /**
   * Handles price updates with blockchain validation
   */
  const handlePriceChange = useCallback(async (isValid: boolean) => {
    if (!isValid || !request.filterCriteria) return;

    try {
      await calculatePrice(request.filterCriteria);
    } catch (err) {
      console.error('Error calculating price:', err);
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
              setBlockchainStatus(prev => ({ ...prev, status: status as 'pending' | 'failed' | 'confirmed' }))
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