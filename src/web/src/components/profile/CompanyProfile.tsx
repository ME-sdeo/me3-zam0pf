import React, { useState, useEffect, useCallback } from 'react';
import { 
  TextField, 
  Button, 
  Grid, 
  Typography, 
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton
} from '@mui/material';
import { 
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format, isAfter, addMonths } from 'date-fns';

import { Card } from '../common/Card';
import { 
  ICompany, 
  ICompanyProfile, 
  ICompanyCertification,
  CompanyType 
} from '../../interfaces/company.interface';
import { useNotification } from '../../hooks/useNotification';
import axiosInstance from '../../utils/api.util';
import { API_ENDPOINTS } from '../../constants/api.constants';
import type { Notification } from '../../services/notification.service';

interface ICompanyProfileProps {
  companyId: string;
  readOnly?: boolean;
  onUpdate?: (company: ICompany) => void;
  onError?: (error: Error) => void;
}

/**
 * CompanyProfile component for managing company information with enhanced security and validation
 */
export const CompanyProfile: React.FC<ICompanyProfileProps> = React.memo(({
  companyId,
  readOnly = false,
  onUpdate,
  onError
}) => {
  // Rest of the component code remains exactly the same
  const [company, setCompany] = useState<ICompany | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [certificationStatus, setCertificationStatus] = useState<Record<string, boolean>>({});

  const { notifications, markAsRead } = useNotification();

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const response = await axiosInstance.get(`${API_ENDPOINTS.MARKETPLACE.REQUESTS}/${companyId}`);
        setCompany(response.data);
        validateCertifications(response.data.profile.certifications);
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanyData();
  }, [companyId, onError]);

  const validateCertifications = useCallback((certifications: ICompanyCertification[]) => {
    const status: Record<string, boolean> = {};
    const today = new Date();
    const warningThreshold = addMonths(today, 3);

    certifications.forEach(cert => {
      const expiryDate = new Date(cert.expiresAt);
      status[cert.type] = isAfter(expiryDate, today);

      if (isAfter(expiryDate, today) && !isAfter(expiryDate, warningThreshold)) {
        const notification = notifications.find(
          n => n.metadata.certificationType === cert.type && !n.read
        );
        if (notification) {
          markAsRead(notification.id);
        }
      }
    });

    setCertificationStatus(status);
  }, [notifications, markAsRead]);

  const validateForm = useCallback((profile: ICompanyProfile): boolean => {
    const errors: Record<string, string> = {};

    if (!profile.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!profile.website.trim()) {
      errors.website = 'Website is required';
    } else if (!/^https?:\/\/.+/.test(profile.website)) {
      errors.website = 'Website must be a valid URL';
    }
    if (!profile.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s-]{10,}$/.test(profile.phone)) {
      errors.phone = 'Invalid phone number format';
    }

    if (!profile.address.street.trim()) errors['address.street'] = 'Street is required';
    if (!profile.address.city.trim()) errors['address.city'] = 'City is required';
    if (!profile.address.state.trim()) errors['address.state'] = 'State is required';
    if (!profile.address.country.trim()) errors['address.country'] = 'Country is required';
    if (!profile.address.postalCode.trim()) errors['address.postalCode'] = 'Postal code is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  const handleProfileUpdate = async (updatedProfile: ICompanyProfile) => {
    if (!company || !validateForm(updatedProfile)) return;

    try {
      const updatedCompany = {
        ...company,
        profile: updatedProfile
      };

      const response = await axiosInstance.put(
        `${API_ENDPOINTS.MARKETPLACE.REQUESTS}/${companyId}`,
        updatedCompany
      );

      setCompany(response.data);
      setIsEditing(false);
      setIsDirty(false);
      onUpdate?.(response.data);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const handleCertificationUpdate = async (certifications: ICompanyCertification[]) => {
    if (!company) return;

    try {
      const updatedProfile = {
        ...company.profile,
        certifications
      };

      await handleProfileUpdate(updatedProfile);
      validateCertifications(certifications);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Skeleton variant="text" height={40} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={120} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={120} />
          </Grid>
        </Grid>
      </Card>
    );
  }

  if (!company) {
    return (
      <Alert severity="error">
        Company information not found
      </Alert>
    );
  }

  return (
    <Card>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" component="h2">
            Company Profile
            {!readOnly && (
              <Button
                startIcon={isEditing ? <CancelIcon /> : <EditIcon />}
                onClick={() => setIsEditing(!isEditing)}
                sx={{ ml: 2 }}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            )}
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Company Name"
            value={company.name}
            disabled={!isEditing || readOnly}
            error={!!formErrors.name}
            helperText={formErrors.name}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? { ...prev, name: e.target.value } : null);
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Company Type</InputLabel>
            <Select
              value={company.type}
              label="Company Type"
              disabled={!isEditing || readOnly}
              onChange={e => {
                setIsDirty(true);
                setCompany(prev => prev ? { ...prev, type: e.target.value as CompanyType } : null);
              }}
            >
              {Object.values(CompanyType).map(type => (
                <MenuItem key={type} value={type}>
                  {type.replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Contact Information
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            value={company.email}
            disabled={!isEditing || readOnly}
            error={!!formErrors.email}
            helperText={formErrors.email}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? { ...prev, email: e.target.value } : null);
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone"
            value={company.profile.phone}
            disabled={!isEditing || readOnly}
            error={!!formErrors.phone}
            helperText={formErrors.phone}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? {
                ...prev,
                profile: { ...prev.profile, phone: e.target.value }
              } : null);
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Address
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Street"
            value={company.profile.address.street}
            disabled={!isEditing || readOnly}
            error={!!formErrors['address.street']}
            helperText={formErrors['address.street']}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  address: { ...prev.profile.address, street: e.target.value }
                }
              } : null);
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="City"
            value={company.profile.address.city}
            disabled={!isEditing || readOnly}
            error={!!formErrors['address.city']}
            helperText={formErrors['address.city']}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  address: { ...prev.profile.address, city: e.target.value }
                }
              } : null);
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="State"
            value={company.profile.address.state}
            disabled={!isEditing || readOnly}
            error={!!formErrors['address.state']}
            helperText={formErrors['address.state']}
            onChange={e => {
              setIsDirty(true);
              setCompany(prev => prev ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  address: { ...prev.profile.address, state: e.target.value }
                }
              } : null);
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Certifications
          </Typography>
        </Grid>

        <Grid item xs={12}>
          {company.profile.certifications.map((cert, index) => (
            <Chip
              key={cert.type}
              label={`${cert.type} - Expires: ${format(new Date(cert.expiresAt), 'MM/dd/yyyy')}`}
              color={certificationStatus[cert.type] ? 'success' : 'error'}
              icon={!certificationStatus[cert.type] ? <WarningIcon /> : undefined}
              onDelete={isEditing && !readOnly ? () => {
                const updatedCerts = [...company.profile.certifications];
                updatedCerts.splice(index, 1);
                handleCertificationUpdate(updatedCerts);
              } : undefined}
              sx={{ m: 0.5 }}
            />
          ))}
        </Grid>

        {isEditing && !readOnly && (
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              disabled={!isDirty}
              onClick={() => handleProfileUpdate(company.profile)}
            >
              Save Changes
            </Button>
          </Grid>
        )}
      </Grid>
    </Card>
  );
});

CompanyProfile.displayName = 'CompanyProfile';

export default CompanyProfile;