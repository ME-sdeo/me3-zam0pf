import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box,
  Tabs,
  Tab,
  Typography,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Business as BusinessIcon,
  Gavel as GavelIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { ethers } from 'ethers';
import { useFocusRing } from '@react-aria/focus';

import CompanyProfile from '../../components/profile/CompanyProfile';
import SecuritySettings from '../../components/settings/SecuritySettings';
import ComplianceSettings from '../../components/settings/ComplianceSettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import { Card } from '../../components/common/Card';
import { useNotification } from '../../hooks/useNotification';
import axiosInstance from '../../utils/api.util';
import { API_ENDPOINTS } from '../../constants/api.constants';

interface ISettingsTabConfig {
  id: string;
  label: string;
  icon: React.ReactElement;
  component: React.ReactNode;
  ariaLabel: string;
  securityLevel: 'low' | 'medium' | 'high';
  blockchainEnabled: boolean;
  realTimeValidation: boolean;
}

interface BlockchainStatus {
  connected: boolean;
  lastSync: Date | null;
  pendingTransactions: number;
}

interface SecurityValidationState {
  mfaEnabled: boolean;
  lastSecurityAudit: Date | null;
  complianceStatus: 'compliant' | 'non-compliant' | 'pending';
  securityScore: number;
}

const Settings: React.FC = React.memo(() => {
  // State management
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [blockchainStatus, setBlockchainStatus] = useState<BlockchainStatus>({
    connected: false,
    lastSync: null,
    pendingTransactions: 0
  });
  const [securityValidation, setSecurityValidation] = useState<SecurityValidationState>({
    mfaEnabled: false,
    lastSecurityAudit: null,
    complianceStatus: 'pending',
    securityScore: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { focusProps } = useFocusRing();

  // Tab configuration
  const settingsTabs: ISettingsTabConfig[] = [
    {
      id: 'profile',
      label: 'Company Profile',
      icon: <BusinessIcon />,
      component: <CompanyProfile companyId={localStorage.getItem('company_id') || ''} />,
      ariaLabel: 'Manage company profile settings',
      securityLevel: 'low',
      blockchainEnabled: true,
      realTimeValidation: true
    },
    {
      id: 'security',
      label: 'Security Settings',
      icon: <SecurityIcon />,
      component: <SecuritySettings validation={securityValidation} />,
      ariaLabel: 'Manage security and authentication settings',
      securityLevel: 'high',
      blockchainEnabled: true,
      realTimeValidation: true
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: <GavelIcon />,
      component: <ComplianceSettings blockchainStatus={blockchainStatus} />,
      ariaLabel: 'Manage compliance and certification settings',
      securityLevel: 'high',
      blockchainEnabled: true,
      realTimeValidation: true
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <NotificationsIcon />,
      component: <NotificationSettings />,
      ariaLabel: 'Manage notification preferences',
      securityLevel: 'medium',
      blockchainEnabled: false,
      realTimeValidation: false
    }
  ];

  // Initialize blockchain monitoring
  useEffect(() => {
    const initializeBlockchain = async () => {
      try {
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.getNetwork();
          setBlockchainStatus(prev => ({
            ...prev,
            connected: true,
            lastSync: new Date()
          }));
        }
      } catch (error) {
        console.error('Blockchain initialization error:', error);
        setError('Failed to connect to blockchain network');
      }
    };

    initializeBlockchain();
  }, []);

  // Fetch security validation status
  useEffect(() => {
    const fetchSecurityStatus = async () => {
      try {
        const response = await axiosInstance.get(
          `${API_ENDPOINTS.MARKETPLACE.ANALYTICS}/security-status`
        );
        setSecurityValidation(response.data);
      } catch (error) {
        console.error('Security status fetch error:', error);
        setError('Failed to fetch security status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecurityStatus();
  }, []);

  // Handle secure settings updates
  const handleSecureSettingsUpdate = useCallback(async (
    updateData: any,
    securityLevel: string
  ) => {
    try {
      // Create blockchain transaction for high-security updates
      if (securityLevel === 'high' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        // Record update in blockchain
        const transaction = await signer.sendTransaction({
          to: process.env.REACT_APP_SMART_CONTRACT_ADDRESS,
          data: ethers.utils.id(JSON.stringify(updateData))
        });
        
        await transaction.wait();
      }

      // Update settings in backend
      await axiosInstance.put(
        `${API_ENDPOINTS.MARKETPLACE.REQUESTS}/settings`,
        updateData
      );

      setBlockchainStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        pendingTransactions: Math.max(0, prev.pendingTransactions - 1)
      }));
    } catch (error) {
      console.error('Settings update error:', error);
      setError('Failed to update settings');
    }
  }, []);

  // Handle tab changes
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  }, []);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <Box sx={{ width: '100%' }}>
        {error && (
          <Alert 
            severity="error" 
            icon={<WarningIcon />}
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Typography variant="h5" component="h1" gutterBottom>
          Company Settings
        </Typography>

        <Paper elevation={0}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Company settings navigation"
            variant="scrollable"
            scrollButtons="auto"
            {...focusProps}
          >
            {settingsTabs.map(tab => (
              <Tab
                key={tab.id}
                value={tab.id}
                label={tab.label}
                icon={tab.icon}
                aria-label={tab.ariaLabel}
                sx={{
                  '&.Mui-focusVisible': {
                    outline: '2px solid #2196F3',
                    outlineOffset: '2px'
                  }
                }}
              />
            ))}
          </Tabs>
        </Paper>

        <Box sx={{ mt: 3 }}>
          {settingsTabs.map(tab => (
            <Box
              key={tab.id}
              role="tabpanel"
              hidden={activeTab !== tab.id}
              id={`settings-tabpanel-${tab.id}`}
              aria-labelledby={`settings-tab-${tab.id}`}
            >
              {activeTab === tab.id && (
                <Box sx={{ p: 3 }}>
                  {React.cloneElement(tab.component as React.ReactElement, {
                    onUpdate: (data: any) => handleSecureSettingsUpdate(data, tab.securityLevel),
                    blockchainEnabled: tab.blockchainEnabled,
                    realTimeValidation: tab.realTimeValidation
                  })}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
  );
});

Settings.displayName = 'Settings';

export default Settings;