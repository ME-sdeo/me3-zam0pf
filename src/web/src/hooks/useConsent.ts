/**
 * @fileoverview Custom React hook for managing secure, HIPAA-compliant consent operations
 * Implements comprehensive consent management with blockchain verification and audit logging
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  IConsent, 
  ConsentStatus, 
  IConsentPermissions, 
  ValidationSeverity 
} from '../interfaces/consent.interface';
import { 
  fetchConsents, 
  grantConsent, 
  revokeConsent, 
  verifyBlockchainConsent, 
  logConsentAudit 
} from '../store/actions/consent.actions';
import ConsentService from '../services/consent.service';

/**
 * Interface for loading states of consent operations
 */
interface ILoadingState {
  fetchLoading: boolean;
  grantLoading: boolean;
  revokeLoading: boolean;
  verifyLoading: boolean;
}

/**
 * Interface for error states of consent operations
 */
interface IErrorState {
  fetchError: string | null;
  grantError: string | null;
  revokeError: string | null;
  verifyError: string | null;
}

/**
 * Custom hook for managing secure consent operations with blockchain verification
 * @returns Object containing consent state and operations
 */
export const useConsent = () => {
  const dispatch = useDispatch();

  // Initialize loading and error states
  const [loading, setLoading] = useState<ILoadingState>({
    fetchLoading: false,
    grantLoading: false,
    revokeLoading: false,
    verifyLoading: false
  });

  const [error, setError] = useState<IErrorState>({
    fetchError: null,
    grantError: null,
    revokeError: null,
    verifyError: null
  });

  // Select consents from Redux store with memoization
  const consents = useSelector((state: any) => state.consent.consents);
  const auditLog = useSelector((state: any) => state.consent.auditLog);

  /**
   * Fetches all consents with blockchain verification
   */
  const fetchUserConsents = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, fetchLoading: true }));
      setError(prev => ({ ...prev, fetchError: null }));

      await dispatch(fetchConsents());

      dispatch(logConsentAudit('info', 'Successfully fetched user consents'));
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(prev => ({ ...prev, fetchError: errorMessage }));
      dispatch(logConsentAudit('error', 'Failed to fetch consents', { error: errorMessage }));
    } finally {
      setLoading(prev => ({ ...prev, fetchLoading: false }));
    }
  }, [dispatch]);

  /**
   * Grants new consent with blockchain verification
   */
  const handleGrantConsent = useCallback(async (consentData: Omit<IConsent, 'id' | 'blockchainRef'>) => {
    try {
      setLoading(prev => ({ ...prev, grantLoading: true }));
      setError(prev => ({ ...prev, grantError: null }));

      const createdConsent = await dispatch(grantConsent(consentData));

      // Verify blockchain record
      await dispatch(verifyBlockchainConsent(createdConsent.payload));

      dispatch(logConsentAudit('info', 'Successfully granted consent', { 
        consentId: createdConsent.payload.id 
      }));

      return createdConsent.payload;
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(prev => ({ ...prev, grantError: errorMessage }));
      dispatch(logConsentAudit('error', 'Failed to grant consent', { error: errorMessage }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, grantLoading: false }));
    }
  }, [dispatch]);

  /**
   * Revokes existing consent with blockchain verification
   */
  const handleRevokeConsent = useCallback(async (consentId: string) => {
    try {
      setLoading(prev => ({ ...prev, revokeLoading: true }));
      setError(prev => ({ ...prev, revokeError: null }));

      await dispatch(revokeConsent(consentId));

      dispatch(logConsentAudit('info', 'Successfully revoked consent', { consentId }));
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(prev => ({ ...prev, revokeError: errorMessage }));
      dispatch(logConsentAudit('error', 'Failed to revoke consent', { 
        error: errorMessage,
        consentId 
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, revokeLoading: false }));
    }
  }, [dispatch]);

  /**
   * Verifies blockchain record for consent
   */
  const verifyConsent = useCallback(async (consent: IConsent) => {
    try {
      setLoading(prev => ({ ...prev, verifyLoading: true }));
      setError(prev => ({ ...prev, verifyError: null }));

      const isValid = await dispatch(verifyBlockchainConsent(consent));

      dispatch(logConsentAudit('info', 'Successfully verified consent blockchain record', {
        consentId: consent.id
      }));

      return isValid;
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(prev => ({ ...prev, verifyError: errorMessage }));
      dispatch(logConsentAudit('error', 'Failed to verify consent blockchain record', {
        error: errorMessage,
        consentId: consent.id
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, verifyLoading: false }));
    }
  }, [dispatch]);

  /**
   * Checks validity of consent including expiration and blockchain verification
   */
  const checkValidity = useCallback((consent: IConsent): boolean => {
    try {
      // Check consent status
      if (consent.status !== ConsentStatus.ACTIVE) {
        return false;
      }

      // Check expiration
      const now = new Date();
      if (new Date(consent.validTo) < now) {
        return false;
      }

      // Check blockchain reference exists
      if (!consent.blockchainRef) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking consent validity:', error);
      return false;
    }
  }, []);

  // Fetch consents on mount
  useEffect(() => {
    fetchUserConsents();
  }, [fetchUserConsents]);

  // Memoize active consents
  const activeConsents = useMemo(() => 
    consents.filter((consent: IConsent) => checkValidity(consent)),
    [consents, checkValidity]
  );

  return {
    consents: activeConsents,
    loading,
    error,
    fetchConsents: fetchUserConsents,
    grantConsent: handleGrantConsent,
    revokeConsent: handleRevokeConsent,
    checkValidity,
    verifyBlockchain: verifyConsent,
    auditLog
  };
};

export default useConsent;