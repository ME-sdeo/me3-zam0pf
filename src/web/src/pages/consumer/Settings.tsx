import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../hooks/useAuth';
import { MFAMethod } from '../../types/auth.types';

// Enhanced settings form validation schema with HIPAA compliance rules
const settingsSchema = yup.object().shape({
  notificationPreferences: yup.object({
    emailNotifications: yup.boolean().required(),
    smsNotifications: yup.boolean().required(),
    marketplaceUpdates: yup.boolean().required(),
    securityAlerts: yup.boolean().required(),
    complianceUpdates: yup.boolean().required()
  }),
  dataSharingPreferences: yup.object({
    allowAnonymousSharing: yup.boolean().required(),
    allowResearchUse: yup.boolean().required(),
    allowCommercialUse: yup.boolean().required(),
    hipaaCompliance: yup.boolean().required(),
    gdprCompliance: yup.boolean().required()
  }),
  securitySettings: yup.object({
    mfaEnabled: yup.boolean().required(),
    mfaMethod: yup.string()
      .oneOf(['sms', 'authenticator', 'biometric'])
      .when('mfaEnabled', {
        is: true,
        then: schema => schema.required('MFA method is required when MFA is enabled')
      }),
    sessionTimeout: yup.number().min(5).max(60).required(),
    securityAuditEnabled: yup.boolean().required()
  })
});

interface ISettingsProps {
  className?: string;
  theme?: 'light' | 'dark' | 'high-contrast';
  securityLevel?: 'standard' | 'enhanced' | 'hipaa';
}

interface ISettingsFormData {
  notificationPreferences: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketplaceUpdates: boolean;
    securityAlerts: boolean;
    complianceUpdates: boolean;
  };
  dataSharingPreferences: {
    allowAnonymousSharing: boolean;
    allowResearchUse: boolean;
    allowCommercialUse: boolean;
    hipaaCompliance: boolean;
    gdprCompliance: boolean;
  };
  securitySettings: {
    mfaEnabled: boolean;
    mfaMethod: 'sms' | 'authenticator' | 'biometric';
    sessionTimeout: number;
    securityAuditEnabled: boolean;
  };
}

export const Settings: React.FC<ISettingsProps> = React.memo(({ 
  className,
  theme = 'light',
  securityLevel = 'hipaa'
}) => {
  const { user, setupMFA, securityMetrics } = useAuth();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ISettingsFormData>({
    resolver: yup.object().shape(settingsSchema),
    defaultValues: {
      notificationPreferences: {
        emailNotifications: true,
        smsNotifications: true,
        marketplaceUpdates: true,
        securityAlerts: true,
        complianceUpdates: true
      },
      dataSharingPreferences: {
        allowAnonymousSharing: false,
        allowResearchUse: true,
        allowCommercialUse: false,
        hipaaCompliance: true,
        gdprCompliance: true
      },
      securitySettings: {
        mfaEnabled: user?.mfaEnabled || false,
        mfaMethod: user?.azureAccount?.preferredMFAMethod || 'authenticator',
        sessionTimeout: 30,
        securityAuditEnabled: true
      }
    }
  });

  const watchMFAEnabled = watch('securitySettings.mfaEnabled');

  // Handle settings form submission with security tracking
  const onSubmit = useCallback(async (data: ISettingsFormData) => {
    try {
      securityMetrics.trackSettingsUpdate(user?.id, 'settings_update');

      if (data.securitySettings.mfaEnabled && !user?.mfaEnabled) {
        await setupMFA(data.securitySettings.mfaMethod as MFAMethod);
      }

      // Additional settings update logic here
      securityMetrics.trackSettingsUpdateSuccess(user?.id);
    } catch (error) {
      securityMetrics.trackSettingsUpdateFailure(user?.id, error);
      throw error;
    }
  }, [user, setupMFA, securityMetrics]);

  // Monitor security metrics
  useEffect(() => {
    const interval = setInterval(() => {
      securityMetrics.trackSecurityStatus(user?.id);
    }, 60000);

    return () => clearInterval(interval);
  }, [user, securityMetrics]);

  return (
    <div className={className} data-theme={theme} data-security-level={securityLevel}>
      <PageHeader
        title="Settings"
        subtitle="Manage your account preferences and security settings"
        theme={theme}
      />

      <form onSubmit={handleSubmit(onSubmit)} aria-label="Settings form">
        {/* Notification Preferences Section */}
        <Card
          className="settings-section"
          ariaLabel="Notification preferences"
        >
          <h2 className="settings-section__title">Notification Preferences</h2>
          <div className="settings-section__content">
            <label className="settings-checkbox">
              <input
                type="checkbox"
                {...register('notificationPreferences.emailNotifications')}
                aria-describedby="email-notifications-error"
              />
              Email Notifications
            </label>
            {/* Additional notification preferences fields */}
          </div>
        </Card>

        {/* Data Sharing Preferences Section */}
        <Card
          className="settings-section"
          ariaLabel="Data sharing preferences"
        >
          <h2 className="settings-section__title">Data Sharing Preferences</h2>
          <div className="settings-section__content">
            <div className="settings-checkbox">
              <input
                type="checkbox"
                {...register('dataSharingPreferences.hipaaCompliance')}
                aria-describedby="hipaa-compliance-error"
              />
              <label>HIPAA Compliance</label>
            </div>
            {/* Additional data sharing preferences fields */}
          </div>
        </Card>

        {/* Security Settings Section */}
        <Card
          className="settings-section"
          ariaLabel="Security settings"
        >
          <h2 className="settings-section__title">Security Settings</h2>
          <div className="settings-section__content">
            <div className="settings-checkbox">
              <input
                type="checkbox"
                {...register('securitySettings.mfaEnabled')}
                aria-describedby="mfa-enabled-error"
              />
              <label>Enable Multi-Factor Authentication</label>
            </div>

            {watchMFAEnabled && (
              <div className="settings-select">
                <label htmlFor="mfa-method">MFA Method</label>
                <select
                  id="mfa-method"
                  {...register('securitySettings.mfaMethod')}
                  aria-describedby="mfa-method-error"
                >
                  <option value="authenticator">Authenticator App</option>
                  <option value="sms">SMS</option>
                  <option value="biometric">Biometric</option>
                </select>
              </div>
            )}
            {/* Additional security settings fields */}
          </div>
        </Card>

        <div className="settings-actions">
          <button
            type="submit"
            className="settings-submit"
            aria-label="Save settings"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
});

Settings.displayName = 'Settings';

export default Settings;