/**
 * @fileoverview Enhanced Consent Form Component
 * Implements HIPAA/GDPR-compliant consent management with blockchain verification
 * and field-level encryption for healthcare data sharing permissions
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';

import { IConsent, ConsentAccessLevel, EncryptionLevel } from '../../interfaces/consent.interface';
import { useConsent } from '../../hooks/useConsent';
import { validateFHIRResource } from '../../utils/validation.util';
import { FHIR_VALIDATION } from '../../constants/validation.constants';

// Validation schema for consent form
const validationSchema = yup.object().shape({
  resourceTypes: yup
    .array()
    .of(yup.string())
    .min(1, 'At least one resource type must be selected')
    .required('Resource types are required'),
  accessLevel: yup
    .string()
    .oneOf(Object.values(ConsentAccessLevel))
    .required('Access level is required'),
  dataElements: yup
    .array()
    .of(yup.string())
    .min(1, 'At least one data element must be selected')
    .required('Data elements are required'),
  purpose: yup
    .string()
    .min(10, 'Purpose must be at least 10 characters')
    .max(500, 'Purpose cannot exceed 500 characters')
    .required('Purpose is required'),
  validFrom: yup
    .date()
    .min(new Date(), 'Start date cannot be in the past')
    .required('Start date is required'),
  validTo: yup
    .date()
    .test('valid-date-range', 'End date must be after start date and within 1 year', function(value) {
      const { validFrom } = this.parent;
      if (!value || !validFrom) return false;
      const start = dayjs(validFrom);
      const end = dayjs(value);
      return end.isAfter(start) && end.diff(start, 'year') <= 1;
    })
    .required('End date is required'),
  encryptedFields: yup
    .array()
    .of(yup.string())
    .required('Encrypted fields must be specified'),
  blockchainVerification: yup
    .boolean()
    .oneOf([true], 'Blockchain verification is required')
});

interface ConsentFormProps {
  requestId: string;
  companyId: string;
  onSuccess: (consent: IConsent) => void;
  onCancel: () => void;
  encryptionConfig: {
    level: EncryptionLevel;
    fields: string[];
  };
  blockchainConfig: {
    required: boolean;
    networkId: string;
  };
}

export const ConsentForm: React.FC<ConsentFormProps> = ({
  requestId,
  companyId,
  onSuccess,
  onCancel,
  encryptionConfig,
  blockchainConfig
}) => {
  const [blockchainStatus, setBlockchainStatus] = useState<{
    verified: boolean;
    error?: string;
  }>({ verified: false });

  const { grantConsent, verifyBlockchain, loading } = useConsent();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      resourceTypes: [],
      accessLevel: ConsentAccessLevel.READ,
      dataElements: [],
      purpose: '',
      validFrom: new Date(),
      validTo: dayjs().add(1, 'year').toDate(),
      encryptedFields: encryptionConfig.fields,
      blockchainVerification: blockchainConfig.required
    }
  });

  // Watch form values for validation
  const formValues = watch();

  // Validate FHIR resource types
  useEffect(() => {
    const validateResources = async () => {
      for (const resourceType of formValues.resourceTypes || []) {
        if (resourceType) {
          const validation = await validateFHIRResource({ resourceType });
          if (!validation.valid) {
            console.error(`Invalid FHIR resource type: ${resourceType}`);
          }
        }
      }
    };
    validateResources();
  }, [formValues.resourceTypes]);

  const onSubmit = async (data: any) => {
    try {
      // Create consent with blockchain verification
      const consentData: Omit<IConsent, 'id' | 'blockchainRef'> = {
        requestId,
        companyId,
        permissions: {
          resourceTypes: data.resourceTypes,
          accessLevel: data.accessLevel,
          dataElements: data.dataElements,
          purpose: data.purpose,
          encryptionLevel: encryptionConfig.level,
          constraints: {},
          metadata: {}
        },
        validFrom: data.validFrom,
        validTo: data.validTo,
        status: 'PENDING',
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        metadata: {}
      };

      const createdConsent = await grantConsent(consentData);

      // Verify blockchain record
      if (blockchainConfig.required) {
        const verified = await verifyBlockchain(createdConsent);
        if (!verified) {
          setBlockchainStatus({
            verified: false,
            error: 'Blockchain verification failed'
          });
          return;
        }
        setBlockchainStatus({ verified: true });
      }

      onSuccess(createdConsent);
    } catch (error) {
      console.error('Error creating consent:', error);
      setBlockchainStatus({
        verified: false,
        error: (error as Error).message
      });
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Grant Consent for Data Access
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Resource Types Selection */}
          <Grid item xs={12}>
            <Controller
              name="resourceTypes"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.resourceTypes}>
                  <Select
                    {...field}
                    multiple
                    displayEmpty
                    value={field.value || []}
                    renderValue={(selected: string[]) => 
                      selected.join(', ') || 'Select Resource Types'
                    }
                  >
                    {FHIR_VALIDATION.RESOURCE_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors.resourceTypes?.message}
                  </FormHelperText>
                </FormControl>
              )}
            />
          </Grid>

          {/* Access Level Selection */}
          <Grid item xs={12}>
            <Controller
              name="accessLevel"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.accessLevel}>
                  <Select {...field} displayEmpty>
                    {Object.values(ConsentAccessLevel).map((level) => (
                      <MenuItem key={level} value={level}>
                        {level}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors.accessLevel?.message}
                  </FormHelperText>
                </FormControl>
              )}
            />
          </Grid>

          {/* Purpose Input */}
          <Grid item xs={12}>
            <Controller
              name="purpose"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  label="Purpose of Data Access"
                  error={!!errors.purpose}
                  helperText={errors.purpose?.message}
                />
              )}
            />
          </Grid>

          {/* Validity Period */}
          <Grid item xs={6}>
            <Controller
              name="validFrom"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  label="Valid From"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.validFrom,
                      helperText: errors.validFrom?.message
                    }
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={6}>
            <Controller
              name="validTo"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  label="Valid To"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.validTo,
                      helperText: errors.validTo?.message
                    }
                  }}
                />
              )}
            />
          </Grid>

          {/* Blockchain Verification */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Controller
                  name="blockchainVerification"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      {...field}
                      checked={field.value}
                      disabled={blockchainConfig.required}
                    />
                  )}
                />
              }
              label="Enable Blockchain Verification"
            />
            {blockchainStatus.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {blockchainStatus.error}
              </Alert>
            )}
          </Grid>

          {/* Form Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={!!loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!!loading || (blockchainConfig.required && !blockchainStatus.verified)}
              >
                {loading ? 'Processing...' : 'Grant Consent'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default ConsentForm;