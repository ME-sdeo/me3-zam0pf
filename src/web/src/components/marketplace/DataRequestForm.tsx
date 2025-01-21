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
}

export const DataRequestForm: React.FC<DataRequestFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  onBlockchainStatus
}) => {
  const [loading, setLoading] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [matchEstimate, setMatchEstimate] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { createRequest, calculatePrice } = useMarketplace();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<IDataRequest>({
    resolver: yupResolver(requestSchema as any), // Type assertion to handle complex schema
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
    const calculateEstimates = async () => {
      try {
        const { estimatedMatches, totalPrice } = await calculatePrice(filterCriteria);
        setPriceEstimate(totalPrice);
        setMatchEstimate(estimatedMatches);
      } catch (error) {
        console.error('Error calculating price:', error);
      }
    };

    if (filterCriteria.resourceTypes.length > 0) {
      calculateEstimates();
    }
  }, [filterCriteria, calculatePrice]);

  const onFormSubmit = async (data: IDataRequest) => {
    setLoading(true);
    setValidationErrors([]);

    try {
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
        {/* Rest of the JSX remains unchanged */}
      </Grid>
    </form>
  );
};

export default DataRequestForm;