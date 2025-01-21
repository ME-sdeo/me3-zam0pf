import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form'; // ^7.43.0
import * as yup from 'yup'; // ^1.0.0
import { Card } from '../common/Card';
import { useAuth } from '../../hooks/useAuth';
import { MFAMethod } from '../../types/auth.types';

// Props interface with accessibility support
interface IUserProfileProps {
  className?: string;
  ariaLabel?: string;
  theme?: 'light' | 'dark';
}

// Extended form data interface
interface IProfileFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phone: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    types: string[];
  };
  dataVisibility: {
    profileVisibility: 'public' | 'private' | 'selective';
    allowedDataTypes: string[];
    restrictedCompanies: string[];
  };
  privacySettings: {
    dataRetentionPeriod: number;
    anonymizeData: boolean;
    dataUsageRestrictions: string[];
  };
}

// Validation schema
const profileSchema = yup.object().shape({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  dateOfBirth: yup.date().required('Date of birth is required').max(new Date()),
  phone: yup.string()
    .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number')
    .required('Phone number is required'),
  address: yup.string().required('Address is required'),
  emergencyContact: yup.object().shape({
    name: yup.string().required('Emergency contact name is required'),
    relationship: yup.string().required('Relationship is required'),
    phone: yup.string()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number')
      .required('Emergency contact phone is required')
  }),
  notificationPreferences: yup.object().shape({
    email: yup.boolean(),
    sms: yup.boolean(),
    push: yup.boolean(),
    types: yup.array().of(yup.string())
  }),
  dataVisibility: yup.object().shape({
    profileVisibility: yup.string().oneOf(['public', 'private', 'selective']),
    allowedDataTypes: yup.array().of(yup.string()),
    restrictedCompanies: yup.array().of(yup.string())
  }),
  privacySettings: yup.object().shape({
    dataRetentionPeriod: yup.number().min(1),
    anonymizeData: yup.boolean(),
    dataUsageRestrictions: yup.array().of(yup.string())
  })
});

export const UserProfile: React.FC<IUserProfileProps> = React.memo(({
  className,
  ariaLabel = 'User Profile Settings'
}) => {
  const { user, setupMFA, securityMetrics } = useAuth();
  
  const { register, handleSubmit, formState: { errors } } = useForm<IProfileFormData>({
    defaultValues: {
      firstName: user?.profile.firstName || '',
      lastName: user?.profile.lastName || '',
      dateOfBirth: user?.profile.dateOfBirth || new Date(),
      phone: user?.profile.phone || '',
      address: user?.profile.address || '',
      emergencyContact: user?.profile.emergencyContact || {
        name: '',
        relationship: '',
        phone: ''
      },
      notificationPreferences: user?.preferences.notificationPreferences || {
        email: true,
        sms: false,
        push: false,
        types: []
      },
      dataVisibility: user?.preferences.dataVisibility || {
        profileVisibility: 'private',
        allowedDataTypes: [],
        restrictedCompanies: []
      },
      privacySettings: user?.preferences.privacySettings || {
        dataRetentionPeriod: 365,
        anonymizeData: true,
        dataUsageRestrictions: []
      }
    }
  });

  const handleProfileUpdate = useCallback(async (data: IProfileFormData) => {
    try {
      securityMetrics.trackProfileUpdate(user?.id);
      // API call to update profile would go here
      console.log('Profile updated:', data);
    } catch (error) {
      securityMetrics.trackProfileUpdateError(user?.id, error);
      console.error('Profile update failed:', error);
    }
  }, [user, securityMetrics]);

  const handleMFASetup = useCallback(async (method: MFAMethod) => {
    try {
      await setupMFA(method);
      securityMetrics.trackMFASetup(user?.id, method);
    } catch (error) {
      securityMetrics.trackMFASetupError(user?.id, error);
      console.error('MFA setup failed:', error);
    }
  }, [user, setupMFA, securityMetrics]);

  return (
    <div className={className} role="main" aria-label={ariaLabel}>
      <Card
        elevated
        className="profile-card"
        ariaLabel="Personal Information"
      >
        <form onSubmit={handleSubmit(handleProfileUpdate)}>
          <div className="profile-section">
            <h2>Personal Information</h2>
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                {...register('firstName')}
                aria-invalid={!!errors.firstName}
                aria-describedby="firstName-error"
              />
              {errors.firstName && (
                <span id="firstName-error" className="error">
                  {errors.firstName.message}
                </span>
              )}
            </div>
            {/* Similar form groups for other personal information fields */}
          </div>

          <div className="profile-section">
            <h2>Security Settings</h2>
            <div className="mfa-options">
              <button
                type="button"
                onClick={() => handleMFASetup(MFAMethod.AUTHENTICATOR_APP)}
                aria-label="Setup Authenticator App MFA"
              >
                Setup Authenticator App
              </button>
              <button
                type="button"
                onClick={() => handleMFASetup(MFAMethod.SMS)}
                aria-label="Setup SMS MFA"
              >
                Setup SMS Authentication
              </button>
            </div>
          </div>

          <div className="profile-section">
            <h2>Privacy & Data Sharing</h2>
            {/* Data sharing and privacy settings form groups */}
          </div>

          <div className="profile-section">
            <h2>Notification Preferences</h2>
            {/* Notification preferences form groups */}
          </div>

          <button
            type="submit"
            className="submit-button"
            aria-label="Save Profile Changes"
          >
            Save Changes
          </button>
        </form>
      </Card>
    </div>
  );
});

UserProfile.displayName = 'UserProfile';

export default UserProfile;