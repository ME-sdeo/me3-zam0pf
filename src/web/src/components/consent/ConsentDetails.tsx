/**
 * @fileoverview Enhanced ConsentDetails component for displaying HIPAA-compliant consent information
 * Implements secure consent display with blockchain verification and comprehensive audit logging
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { withErrorBoundary } from 'react-error-boundary';
import { useTheme } from '@mui/material';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { IConsent } from '../../interfaces/consent.interface';
import { useConsent } from '../../hooks/useConsent';

/**
 * Props interface for ConsentDetails component
 */
interface IConsentDetailsProps {
  consent: IConsent;
  onRevoke: (id: string) => Promise<void>;
  onAuditLog: (event: { type: string; message: string; metadata?: any }) => void;
  className?: string;
  theme?: any;
  showBlockchainDetails?: boolean;
}

/**
 * Enhanced ConsentDetails component with blockchain verification and audit logging
 */
const ConsentDetails: React.FC<IConsentDetailsProps> = React.memo(({
  consent,
  onRevoke,
  onAuditLog,
  className,
  showBlockchainDetails = true
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { checkValidity, verifyBlockchain, logAuditEvent } = useConsent();

  // State for revocation dialog
  const [revokeDialogOpen, setRevokeDialogOpen] = React.useState(false);
  const [blockchainVerified, setBlockchainVerified] = React.useState(false);
  const [verificationError, setVerificationError] = React.useState<string | null>(null);

  /**
   * Verify blockchain record on mount
   */
  useEffect(() => {
    const verifyConsentBlockchain = async () => {
      try {
        const isValid = await verifyBlockchain(consent);
        setBlockchainVerified(isValid);
        
        // Log verification result
        logAuditEvent({
          type: 'BLOCKCHAIN_VERIFICATION',
          message: isValid ? 'Blockchain verification successful' : 'Blockchain verification failed',
          metadata: { consentId: consent.id }
        });
      } catch (error) {
        setVerificationError((error as Error).message);
        setBlockchainVerified(false);
      }
    };

    verifyConsentBlockchain();
  }, [consent, verifyBlockchain, logAuditEvent]);

  /**
   * Format date for display with security context
   */
  const formatSecureDate = useCallback((date: Date): string => {
    try {
      return format(new Date(date), 'PPpp');
    } catch {
      return 'Invalid Date';
    }
  }, []);

  /**
   * Handle consent revocation with confirmation
   */
  const handleRevoke = async () => {
    try {
      await onRevoke(consent.id);
      setRevokeDialogOpen(false);
      
      // Log revocation
      onAuditLog({
        type: 'CONSENT_REVOKED',
        message: 'Consent successfully revoked',
        metadata: { consentId: consent.id }
      });
    } catch (error) {
      console.error('Error revoking consent:', error);
      onAuditLog({
        type: 'CONSENT_REVOKE_ERROR',
        message: 'Failed to revoke consent',
        metadata: { consentId: consent.id, error: (error as Error).message }
      });
    }
  };

  /**
   * Memoized consent validity check
   */
  const isValid = useMemo(() => checkValidity(consent), [consent, checkValidity]);

  return (
    <Card 
      className={`consent-details ${className}`}
      elevation={3}
      sx={{ 
        borderRadius: 2,
        backgroundColor: theme.palette.background.paper
      }}
    >
      <CardContent>
        {/* Status Section */}
        <Box mb={2}>
          <Chip
            label={t(`consent.status.${consent.status.toLowerCase()}`)}
            color={isValid ? 'success' : 'error'}
            className={`consent-details__status consent-details__status--${consent.status.toLowerCase()}`}
          />
        </Box>

        {/* Permissions Section */}
        <Typography variant="h6" gutterBottom>
          {t('consent.permissions.title')}
        </Typography>
        <List className="consent-details__permissions">
          {consent.permissions.resourceTypes.map((type) => (
            <ListItem key={type}>
              <ListItemText
                primary={t(`resource.types.${type.toLowerCase()}`)}
                secondary={t(`consent.access.${consent.permissions.accessLevel.toLowerCase()}`)}
              />
            </ListItem>
          ))}
        </List>
        <Divider />

        {/* Validity Period */}
        <Box my={2} className="consent-details__validity">
          <Typography variant="subtitle2">
            {t('consent.validity.from')}: {formatSecureDate(consent.validFrom)}
          </Typography>
          <Typography variant="subtitle2">
            {t('consent.validity.to')}: {formatSecureDate(consent.validTo)}
          </Typography>
        </Box>

        {/* Blockchain Verification */}
        {showBlockchainDetails && (
          <Box my={2} className="consent-details__blockchain">
            <Typography variant="subtitle2">
              {t('consent.blockchain.reference')}: {consent.blockchainRef}
            </Typography>
            <Chip
              label={blockchainVerified ? t('consent.blockchain.verified') : t('consent.blockchain.unverified')}
              color={blockchainVerified ? 'success' : 'warning'}
              className={`consent-details__blockchain--${blockchainVerified ? 'verified' : 'unverified'}`}
            />
            {verificationError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {verificationError}
              </Alert>
            )}
          </Box>
        )}

        {/* Encryption Status */}
        <Box my={2} className="consent-details__encryption">
          <Typography variant="subtitle2">
            {t('consent.encryption.status')}: {consent.encryptionStatus}
          </Typography>
        </Box>

        {/* Actions */}
        <Box mt={2} className="consent-details__actions">
          <Button
            variant="contained"
            color="error"
            onClick={() => setRevokeDialogOpen(true)}
            disabled={!isValid}
          >
            {t('consent.actions.revoke')}
          </Button>
        </Box>

        {/* Revocation Dialog */}
        <Dialog
          open={revokeDialogOpen}
          onClose={() => setRevokeDialogOpen(false)}
          aria-labelledby="revoke-dialog-title"
        >
          <DialogTitle id="revoke-dialog-title">
            {t('consent.revoke.confirmation.title')}
          </DialogTitle>
          <DialogContent>
            <Typography>
              {t('consent.revoke.confirmation.message')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRevokeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRevoke} color="error" autoFocus>
              {t('consent.actions.confirm_revoke')}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
});

// Add display name for debugging
ConsentDetails.displayName = 'ConsentDetails';

// Wrap with error boundary
const ConsentDetailsWithErrorBoundary = withErrorBoundary(ConsentDetails, {
  fallback: <Alert severity="error">{t('errors.consent_display_failed')}</Alert>,
  onError: (error) => {
    console.error('ConsentDetails Error:', error);
  }
});

export default ConsentDetailsWithErrorBoundary;