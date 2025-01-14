import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Typography, TextField, CircularProgress, Tooltip } from '@mui/material';
import { useFormik } from 'formik';
import { formatCurrency } from 'react-intl';
import debounce from 'lodash/debounce';

import { IDataRequest } from '../../interfaces/marketplace.interface';
import { useMarketplace } from '../../hooks/useMarketplace';

// Constants for price calculation
const MIN_PRICE_PER_RECORD = 0.1;
const MIN_RECORDS = 1;
const PRICE_UPDATE_DELAY = 300;
const COMPLIANCE_CHECK_INTERVAL = 1000;

interface PriceCalculatorProps {
  request: IDataRequest;
  onPriceChange: (price: number, isValid: boolean) => void;
  complianceMetadata?: Record<string, unknown>;
}

/**
 * PriceCalculator Component
 * Implements real-time price calculation for healthcare data requests with HIPAA compliance
 */
export const PriceCalculator: React.FC<PriceCalculatorProps> = ({
  request,
  onPriceChange,
  complianceMetadata = {}
}) => {
  // State management
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastValidPrice, setLastValidPrice] = useState<number>(request.pricePerRecord);
  const [blockchainStatus, setBlockchainStatus] = useState<{
    transactionId: string | null;
    status: 'pending' | 'confirmed' | 'failed';
  }>({ transactionId: null, status: 'pending' });

  // Refs for tracking mounted state and previous values
  const isMounted = useRef(true);
  const previousPriceRef = useRef<number>(request.pricePerRecord);

  // Custom hooks
  const { calculatePrice, validatePriceCompliance, recordPriceTransaction } = useMarketplace();

  // Formik form handling
  const formik = useFormik({
    initialValues: {
      pricePerRecord: request.pricePerRecord,
      recordsNeeded: request.recordsNeeded
    },
    validate: async (values) => {
      const errors: Record<string, string> = {};

      if (values.pricePerRecord < MIN_PRICE_PER_RECORD) {
        errors.pricePerRecord = `Minimum price per record is ${formatCurrency(MIN_PRICE_PER_RECORD, 'USD')}`;
      }

      if (values.recordsNeeded < MIN_RECORDS) {
        errors.recordsNeeded = `Minimum number of records is ${MIN_RECORDS}`;
      }

      // Validate HIPAA compliance
      const complianceResult = await validatePriceCompliance(values.pricePerRecord, complianceMetadata);
      if (!complianceResult.isValid) {
        errors.pricePerRecord = complianceResult.errors[0];
      }

      return errors;
    },
    onSubmit: async (values) => {
      await handlePriceCalculation(values.pricePerRecord, values.recordsNeeded);
    }
  });

  /**
   * Handles price calculation with blockchain integration
   */
  const handlePriceCalculation = async (price: number, quantity: number) => {
    try {
      setIsCalculating(true);

      // Calculate total price
      const calculation = await calculatePrice(request.filterCriteria);
      
      // Record price update in blockchain
      const transaction = await recordPriceTransaction({
        requestId: request.id,
        price,
        quantity,
        timestamp: new Date().toISOString()
      });

      setBlockchainStatus({
        transactionId: transaction.id,
        status: 'confirmed'
      });

      // Update state if component still mounted
      if (isMounted.current) {
        setLastValidPrice(price);
        onPriceChange(calculation.totalPrice, true);
      }
    } catch (error) {
      console.error('Price calculation error:', error);
      setBlockchainStatus({
        transactionId: null,
        status: 'failed'
      });
      
      // Revert to last valid price
      formik.setFieldValue('pricePerRecord', lastValidPrice);
      onPriceChange(lastValidPrice, false);
    } finally {
      if (isMounted.current) {
        setIsCalculating(false);
      }
    }
  };

  // Debounced price update handler
  const debouncedPriceUpdate = useCallback(
    debounce((price: number, quantity: number) => {
      handlePriceCalculation(price, quantity);
    }, PRICE_UPDATE_DELAY),
    []
  );

  // Effect for price changes
  useEffect(() => {
    const currentPrice = formik.values.pricePerRecord;
    if (currentPrice !== previousPriceRef.current) {
      debouncedPriceUpdate(currentPrice, formik.values.recordsNeeded);
      previousPriceRef.current = currentPrice;
    }
  }, [formik.values.pricePerRecord, formik.values.recordsNeeded]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      debouncedPriceUpdate.cancel();
    };
  }, []);

  return (
    <Card sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Price Calculator
      </Typography>

      <form onSubmit={formik.handleSubmit}>
        <Tooltip title="Enter price per health record">
          <TextField
            fullWidth
            id="pricePerRecord"
            name="pricePerRecord"
            label="Price per Record (USD)"
            type="number"
            value={formik.values.pricePerRecord}
            onChange={formik.handleChange}
            error={formik.touched.pricePerRecord && Boolean(formik.errors.pricePerRecord)}
            helperText={formik.touched.pricePerRecord && formik.errors.pricePerRecord}
            InputProps={{
              startAdornment: '$',
              endAdornment: isCalculating && <CircularProgress size={20} />,
              inputProps: { min: MIN_PRICE_PER_RECORD, step: 0.1 }
            }}
            sx={{ mb: 2 }}
          />
        </Tooltip>

        <Tooltip title="Enter number of records needed">
          <TextField
            fullWidth
            id="recordsNeeded"
            name="recordsNeeded"
            label="Number of Records"
            type="number"
            value={formik.values.recordsNeeded}
            onChange={formik.handleChange}
            error={formik.touched.recordsNeeded && Boolean(formik.errors.recordsNeeded)}
            helperText={formik.touched.recordsNeeded && formik.errors.recordsNeeded}
            InputProps={{
              inputProps: { min: MIN_RECORDS }
            }}
            sx={{ mb: 2 }}
          />
        </Tooltip>

        <Typography variant="subtitle1" color="primary">
          Total Estimated Price: {formatCurrency(
            formik.values.pricePerRecord * formik.values.recordsNeeded,
            'USD'
          )}
        </Typography>

        {blockchainStatus.transactionId && (
          <Typography variant="caption" color="textSecondary">
            Transaction ID: {blockchainStatus.transactionId} ({blockchainStatus.status})
          </Typography>
        )}
      </form>
    </Card>
  );
};

export default PriceCalculator;