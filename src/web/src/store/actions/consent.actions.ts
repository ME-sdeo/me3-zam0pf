/**
 * @fileoverview Redux action creators for HIPAA/GDPR-compliant consent management
 * Implements secure blockchain-verified consent operations with comprehensive audit logging
 * @version 1.0.0
 */

import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { IConsent, ConsentStatus, ValidationSeverity } from '../../interfaces/consent.interface';
import ConsentService from '../../services/consent.service';

// Action type prefix for consent operations
const CONSENT_ACTION_PREFIX = 'consent';

// Timeout for blockchain verification (5 seconds)
const BLOCKCHAIN_VERIFICATION_TIMEOUT = 5000;

// Audit log levels for consent operations
const CONSENT_AUDIT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SECURITY: 'security'
} as const;

/**
 * Action types for consent management operations
 */
export enum ConsentActionTypes {
  FETCH_CONSENTS_REQUEST = 'consent/fetchConsents/pending',
  FETCH_CONSENTS_SUCCESS = 'consent/fetchConsents/fulfilled',
  FETCH_CONSENTS_FAILURE = 'consent/fetchConsents/rejected',
  
  GRANT_CONSENT_REQUEST = 'consent/grantConsent/pending',
  GRANT_CONSENT_SUCCESS = 'consent/grantConsent/fulfilled',
  GRANT_CONSENT_FAILURE = 'consent/grantConsent/rejected',
  
  REVOKE_CONSENT_REQUEST = 'consent/revokeConsent/pending',
  REVOKE_CONSENT_SUCCESS = 'consent/revokeConsent/fulfilled',
  REVOKE_CONSENT_FAILURE = 'consent/revokeConsent/rejected',
  
  VERIFY_BLOCKCHAIN_REQUEST = 'consent/verifyBlockchain/pending',
  VERIFY_BLOCKCHAIN_SUCCESS = 'consent/verifyBlockchain/fulfilled',
  VERIFY_BLOCKCHAIN_FAILURE = 'consent/verifyBlockchain/rejected',
  
  LOG_CONSENT_AUDIT = 'consent/logAudit'
}

/**
 * Fetches all consents for the current user with blockchain verification
 */
export const fetchConsents = createAsyncThunk(
  `${CONSENT_ACTION_PREFIX}/fetchConsents`,
  async (_, { rejectWithValue }) => {
    try {
      // Fetch consents with blockchain verification
      const consents = await ConsentService.getConsents();

      // Filter active and valid consents
      const validConsents = consents.filter(consent => 
        consent.status === ConsentStatus.ACTIVE && 
        consent.blockchainRef
      );

      return validConsents;
    } catch (error) {
      console.error('Error fetching consents:', error);
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Creates a new consent record with blockchain verification
 */
export const grantConsent = createAsyncThunk(
  `${CONSENT_ACTION_PREFIX}/grantConsent`,
  async (consentData: Omit<IConsent, 'id' | 'blockchainRef'>, { rejectWithValue }) => {
    try {
      // Create consent with blockchain verification
      const createdConsent = await ConsentService.createConsent(consentData);

      // Verify blockchain record was created
      if (!createdConsent.blockchainRef) {
        throw new Error('Blockchain verification failed');
      }

      return createdConsent;
    } catch (error) {
      console.error('Error granting consent:', error);
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Revokes an existing consent with blockchain verification
 */
export const revokeConsent = createAsyncThunk(
  `${CONSENT_ACTION_PREFIX}/revokeConsent`,
  async (consentId: string, { rejectWithValue }) => {
    try {
      // Revoke consent with blockchain verification
      await ConsentService.removeConsent(consentId);

      return consentId;
    } catch (error) {
      console.error('Error revoking consent:', error);
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Verifies blockchain record for a consent
 */
export const verifyBlockchainConsent = createAsyncThunk(
  `${CONSENT_ACTION_PREFIX}/verifyBlockchain`,
  async (consent: IConsent, { rejectWithValue, signal }) => {
    try {
      // Create abort controller for timeout
      const timeoutId = setTimeout(() => {
        signal.abort();
      }, BLOCKCHAIN_VERIFICATION_TIMEOUT);

      // Verify blockchain record
      const isValid = await ConsentService.verifyBlockchainConsent(consent);

      clearTimeout(timeoutId);

      if (!isValid) {
        throw new Error('Invalid blockchain record');
      }

      return consent;
    } catch (error) {
      console.error('Error verifying blockchain consent:', error);
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Action creator for logging consent audit events
 */
export const logConsentAudit = createAction(
  ConsentActionTypes.LOG_CONSENT_AUDIT,
  (level: keyof typeof CONSENT_AUDIT_LEVELS, message: string, metadata?: Record<string, unknown>) => ({
    payload: {
      level,
      message,
      metadata,
      timestamp: new Date().toISOString()
    }
  })
);