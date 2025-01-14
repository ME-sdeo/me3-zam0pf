import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormHelperText,
  InputLabel,
  Grid,
  Typography,
  Chip,
  Alert,
} from '@mui/material';

import { IDataRequest } from '../../interfaces/marketplace.interface';
import { useMarketplace } from '../../hooks/useMarketplace';
import Button from '../common/Button';
import { FHIR_RESOURCE_TYPES } from '../../constants/fhir.constants';

// Form validation schema with HIPAA compliance rules
const requestSchema = yup.object().shape({
  title: yup
    .string()
    .required('Title is required')
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters'),
  description: yup
    .string()
    .required('Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must not exceed 500 characters'),
  filterCriteria: yup.object().shape({
    resourceTypes: yup
      .array()
      .of(yup.string().oneOf(Object.values(FHIR_RESOURCE_TYPES)))
      .min(1, 'At least one resource type is required'),
    demographics: yup.object().shape({
      ageRange: yup.object().shape({
        min: yup.number().min(0).max(120),
        max: yup.number().min(0).max(120).moreThan(yup.ref('min'))
      }),
      gender: yup.array().of(yup.string()),
      ethnicity: yup.array().of(yup.string()),
      location: yup.array().of(yup.string())
    }),
    conditions: yup.array().of(yup.string()),
    dateRange: yup.object().shape({
      startDate: yup.date().required(),
      endDate: yup.date().required().min(yup.ref('startDate'))
    })
  }),
  pricePerRecord: yup
    .number()
    .required('Price per record is required')
    .min(0.1, 'Minimum price is $0.10 per record'),
  recordsNeeded: yup
    .number()
    .required('Number of records is required')
    .min(1, 'At least one record is required')
    .max(10000, 'Maximum 10,000 records per request')
});

interface DataRequestFormProps {
  initialData?: Partial<IDataRequest>;
  onSubmit: (data: IDataRequest) => Promise<void>;
  onCancel: () => void;
  onBlockchainStatus?: (status: string) => void;
  onConsentUpdate?: (status: string) => void;
}

export const DataRequestForm: React.FC<DataRequestFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  onBlockchainStatus,
  onConsentUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [matchEstimate, setMatchEstimate] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { createRequest, calculateRequestPrice, validateFHIRResource } = useMarketplace();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setValue
  } = useForm<IDataRequest>({
    resolver: yupResolver(requestSchema),
    defaultValues: initialData || {
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
    }
  });

  // Watch form values for real-time price calculation
  const filterCriteria = watch('filterCriteria');

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        const { estimatedMatches, totalPrice } = await calculateRequestPrice(filterCriteria);
        setPriceEstimate(totalPrice);
        setMatchEstimate(estimatedMatches);
      } catch (error) {
        console.error('Error calculating price:', error);
      }
    };

    if (filterCriteria.resourceTypes.length > 0) {
      calculatePrice();
    }
  }, [filterCriteria, calculateRequestPrice]);

  const onFormSubmit = async (data: IDataRequest) => {
    setLoading(true);
    setValidationErrors([]);

    try {
      // Validate FHIR resource types
      const validationResult = await validateFHIRResource(data.filterCriteria);
      if (!validationResult.valid) {
        setValidationErrors(validationResult.errors);
        return;
      }

      // Create request with blockchain tracking
      const createdRequest = await createRequest(data);
      
      // Update blockchain status
      onBlockchainStatus?.('PENDING');

      await onSubmit(createdRequest);
    } catch (error) {
      console.error('Error submitting request:', error);
      setValidationErrors(['Failed to create request. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} aria-label="Data Request Form">
      <Grid container spacing={3}>
        {/* Title */}
        <Grid item xs={12}>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Request Title"
                fullWidth
                error={!!errors.title}
                helperText={errors.title?.message}
                disabled={loading}
                inputProps={{
                  'aria-label': 'Request Title',
                  'data-testid': 'request-title'
                }}
              />
            )}
          />
        </Grid>

        {/* Description */}
        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                multiline
                rows={4}
                fullWidth
                error={!!errors.description}
                helperText={errors.description?.message}
                disabled={loading}
                inputProps={{
                  'aria-label': 'Request Description',
                  'data-testid': 'request-description'
                }}
              />
            )}
          />
        </Grid>

        {/* Resource Types */}
        <Grid item xs={12}>
          <Controller
            name="filterCriteria.resourceTypes"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.filterCriteria?.resourceTypes}>
                <InputLabel>FHIR Resource Types</InputLabel>
                <Select
                  {...field}
                  multiple
                  disabled={loading}
                  renderValue={(selected) => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </div>
                  )}
                >
                  {Object.values(FHIR_RESOURCE_TYPES).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {errors.filterCriteria?.resourceTypes?.message}
                </FormHelperText>
              </FormControl>
            )}
          />
        </Grid>

        {/* Price and Records */}
        <Grid item xs={12} md={6}>
          <Controller
            name="pricePerRecord"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                label="Price per Record ($)"
                fullWidth
                error={!!errors.pricePerRecord}
                helperText={errors.pricePerRecord?.message}
                disabled={loading}
                inputProps={{
                  min: 0.1,
                  step: 0.01,
                  'aria-label': 'Price per Record',
                  'data-testid': 'price-per-record'
                }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="recordsNeeded"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                label="Records Needed"
                fullWidth
                error={!!errors.recordsNeeded}
                helperText={errors.recordsNeeded?.message}
                disabled={loading}
                inputProps={{
                  min: 1,
                  max: 10000,
                  'aria-label': 'Records Needed',
                  'data-testid': 'records-needed'
                }}
              />
            )}
          />
        </Grid>

        {/* Estimates Display */}
        {priceEstimate !== null && matchEstimate !== null && (
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                Estimated Total Cost: ${(priceEstimate * matchEstimate).toFixed(2)}
              </Typography>
              <Typography variant="body2">
                Estimated Available Matches: {matchEstimate}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="error">
              {validationErrors.map((error, index) => (
                <Typography key={index} variant="body2">
                  {error}
                </Typography>
              ))}
            </Alert>
          </Grid>
        )}

        {/* Form Actions */}
        <Grid item xs={12} container spacing={2} justifyContent="flex-end">
          <Grid item>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              aria-label="Cancel"
            >
              Cancel
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="primary"
              type="submit"
              loading={loading}
              disabled={loading}
              aria-label="Submit Request"
            >
              Submit Request
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </form>
  );
};

export default DataRequestForm;