import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { 
  Chip, 
  IconButton, 
  Tooltip, 
  CircularProgress 
} from '@mui/material';
import { 
  DeleteOutline as DeleteIcon,
  VerifiedUser as VerifiedIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@analytics/react';

import Table from '../common/Table';
import useConsent from '../../hooks/useConsent';
import { ConsentStatus } from '../../interfaces/consent.interface';

interface ConsentListProps {
  pageSize?: number;
  refreshInterval?: number;
  maskSensitiveData?: boolean;
}

const ConsentList: React.FC<ConsentListProps> = ({
  pageSize = 10,
  refreshInterval = 30000,
  maskSensitiveData = true
}) => {
  // State and hooks
  const { 
    consents, 
    loading, 
    fetchConsents, 
    revokeConsent, 
    verifyBlockchain 
  } = useConsent();

  const [blockchainVerification, setBlockchainVerification] = useState<Record<string, boolean>>({});

  // Memoized table columns with security features
  const columns = useMemo(() => [
    {
      field: 'validFrom',
      header: 'Start Date',
      sortable: true,
      width: '15%',
      render: (value: string) => dayjs(value).format('MMM D, YYYY')
    },
    {
      field: 'validTo',
      header: 'End Date',
      sortable: true,
      width: '15%',
      render: (value: string) => dayjs(value).format('MMM D, YYYY')
    },
    {
      field: 'permissions',
      header: 'Access Level',
      sortable: true,
      width: '20%',
      sensitive: maskSensitiveData,
      render: (value: any) => (
        <span>
          {maskSensitiveData ? '••••••' : value.accessLevel}
        </span>
      )
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '15%',
      render: (value: ConsentStatus, row: any) => (
        <Chip
          label={value}
          color={getStatusColor(value, blockchainVerification[row.id])}
          size="small"
          aria-label={`Consent status: ${value}`}
        />
      )
    },
    {
      field: 'blockchainStatus',
      header: 'Verification',
      sortable: true,
      width: '15%',
      render: (_: any, row: any) => (
        <Tooltip title={
          blockchainVerification[row.id] 
            ? 'Blockchain verified' 
            : 'Verification pending'
        }>
          {blockchainVerification[row.id] ? (
            <VerifiedIcon color="success" aria-label="Verified" />
          ) : (
            <WarningIcon color="warning" aria-label="Pending verification" />
          )}
        </Tooltip>
      )
    },
    {
      field: 'actions',
      header: 'Actions',
      sortable: false,
      width: '10%',
      render: (_: any, row: any) => (
        <Tooltip title="Revoke Consent">
          <IconButton
            onClick={() => handleRevokeConsent(row.id)}
            aria-label="Revoke consent"
            disabled={row.status !== ConsentStatus.ACTIVE}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )
    }
  ], [blockchainVerification, maskSensitiveData]);

  // Determine chip color based on status and blockchain verification
  const getStatusColor = (status: ConsentStatus, isVerified: boolean) => {
    if (!isVerified) return 'warning';
    
    switch (status) {
      case ConsentStatus.ACTIVE:
        return 'success';
      case ConsentStatus.REVOKED:
        return 'error';
      case ConsentStatus.EXPIRED:
        return 'error';
      case ConsentStatus.SUSPENDED:
        return 'warning';
      default:
        return 'default';
    }
  };

  // Handle consent revocation with blockchain verification
  const handleRevokeConsent = useCallback(async (consentId: string) => {
    try {
      await revokeConsent(consentId);
      Analytics.track('consent_revoked', { consentId });
      await fetchConsents();
    } catch (error) {
      console.error('Error revoking consent:', error);
      Analytics.track('consent_revoke_error', { 
        consentId, 
        error: (error as Error).message 
      });
    }
  }, [revokeConsent, fetchConsents]);

  // Verify blockchain status for all consents
  const verifyBlockchainStatus = useCallback(async () => {
    const verificationResults: Record<string, boolean> = {};
    
    for (const consent of consents) {
      try {
        const result = await verifyBlockchain(consent);
        verificationResults[consent.id] = result.payload;
      } catch (error) {
        console.error(`Blockchain verification failed for consent ${consent.id}:`, error);
        verificationResults[consent.id] = false;
      }
    }

    setBlockchainVerification(verificationResults);
  }, [consents, verifyBlockchain]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  useEffect(() => {
    verifyBlockchainStatus();
    const interval = setInterval(verifyBlockchainStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [verifyBlockchainStatus, refreshInterval]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div role="alert">
      <h3>Error loading consent records</h3>
      <pre>{error.message}</pre>
    </div>
  );

  if (loading) {
    return (
      <div 
        style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
        aria-label="Loading consent records"
      >
        <CircularProgress />
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div role="region" aria-label="Consent Records List">
        <Table
          columns={columns}
          data={consents}
          pagination
          pageSize={pageSize}
          virtualScroll
          aria-label="Consent records table"
          onSort={(field, direction) => {
            Analytics.track('consent_list_sorted', { field, direction });
          }}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ConsentList;