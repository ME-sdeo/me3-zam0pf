/**
 * @fileoverview Redux reducer for HIPAA-compliant consent management with blockchain verification
 * Implements secure state management for consent operations in MyElixir healthcare data marketplace
 * @version 1.0.0
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit';
import { IConsent } from '../../interfaces/consent.interface';
import { ConsentActionTypes } from '../actions/consent.actions';

/**
 * Interface for audit log entries to maintain HIPAA compliance
 */
interface IAuditLog {
  timestamp: Date;
  action: string;
  status: 'SUCCESS' | 'FAILURE';
  details: string;
  blockchainRef?: string;
}

/**
 * Interface for blockchain status monitoring
 */
interface IStatusMonitoring {
  lastCheck: Date | null;
  status: 'OPERATIONAL' | 'DEGRADED' | 'FAILED';
  verificationErrors?: string[];
}

/**
 * Enhanced interface for consent reducer state with HIPAA compliance
 */
export interface IConsentState {
  consents: IConsent[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  auditLog: IAuditLog[];
  statusMonitoring: IStatusMonitoring;
}

/**
 * Initial state with HIPAA-compliant audit logging
 */
const initialState: IConsentState = {
  consents: [],
  loading: false,
  error: null,
  lastUpdated: null,
  auditLog: [],
  statusMonitoring: {
    lastCheck: null,
    status: 'OPERATIONAL'
  }
};

/**
 * Enhanced reducer with HIPAA compliance and blockchain verification
 */
export const consentReducer = createReducer(initialState, {
  [ConsentActionTypes.FETCH_CONSENTS_REQUEST]: (state) => {
    state.loading = true;
    state.error = null;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'FETCH_CONSENTS_REQUEST',
      status: 'SUCCESS',
      details: 'Initiated consent fetch operation'
    });
  },

  [ConsentActionTypes.FETCH_CONSENTS_SUCCESS]: (state, action: PayloadAction<IConsent[]>) => {
    state.loading = false;
    state.consents = action.payload;
    state.lastUpdated = new Date();
    state.auditLog.push({
      timestamp: new Date(),
      action: 'FETCH_CONSENTS_SUCCESS',
      status: 'SUCCESS',
      details: `Retrieved ${action.payload.length} consents`
    });
  },

  [ConsentActionTypes.FETCH_CONSENTS_FAILURE]: (state, action: PayloadAction<string>) => {
    state.loading = false;
    state.error = action.payload;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'FETCH_CONSENTS_FAILURE',
      status: 'FAILURE',
      details: `Error: ${action.payload}`
    });
  },

  [ConsentActionTypes.GRANT_CONSENT_REQUEST]: (state, action: PayloadAction<Omit<IConsent, 'id' | 'blockchainRef'>>) => {
    state.loading = true;
    state.error = null;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'GRANT_CONSENT_REQUEST',
      status: 'SUCCESS',
      details: `Initiating consent grant for company ${action.payload.companyId}`
    });
  },

  [ConsentActionTypes.GRANT_CONSENT_SUCCESS]: (state, action: PayloadAction<IConsent>) => {
    state.loading = false;
    state.consents.push(action.payload);
    state.lastUpdated = new Date();
    state.auditLog.push({
      timestamp: new Date(),
      action: 'GRANT_CONSENT_SUCCESS',
      status: 'SUCCESS',
      details: `Consent granted with ID ${action.payload.id}`,
      blockchainRef: action.payload.blockchainRef
    });
  },

  [ConsentActionTypes.GRANT_CONSENT_FAILURE]: (state, action: PayloadAction<string>) => {
    state.loading = false;
    state.error = action.payload;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'GRANT_CONSENT_FAILURE',
      status: 'FAILURE',
      details: `Error: ${action.payload}`
    });
  },

  [ConsentActionTypes.REVOKE_CONSENT_REQUEST]: (state, action: PayloadAction<string>) => {
    state.loading = true;
    state.error = null;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'REVOKE_CONSENT_REQUEST',
      status: 'SUCCESS',
      details: `Initiating consent revocation for ID ${action.payload}`
    });
  },

  [ConsentActionTypes.REVOKE_CONSENT_SUCCESS]: (state, action: PayloadAction<string>) => {
    state.loading = false;
    const consentIndex = state.consents.findIndex(consent => consent.id === action.payload);
    if (consentIndex !== -1) {
      state.consents[consentIndex] = {
        ...state.consents[consentIndex],
        status: 'REVOKED'
      };
    }
    state.lastUpdated = new Date();
    state.auditLog.push({
      timestamp: new Date(),
      action: 'REVOKE_CONSENT_SUCCESS',
      status: 'SUCCESS',
      details: `Consent revoked with ID ${action.payload}`,
      blockchainRef: state.consents[consentIndex]?.blockchainRef
    });
  },

  [ConsentActionTypes.REVOKE_CONSENT_FAILURE]: (state, action: PayloadAction<string>) => {
    state.loading = false;
    state.error = action.payload;
    state.auditLog.push({
      timestamp: new Date(),
      action: 'REVOKE_CONSENT_FAILURE',
      status: 'FAILURE',
      details: `Error: ${action.payload}`
    });
  },

  [ConsentActionTypes.VERIFY_BLOCKCHAIN_STATUS]: (state, action: PayloadAction<{ status: 'OPERATIONAL' | 'DEGRADED' | 'FAILED', errors?: string[] }>) => {
    state.statusMonitoring = {
      lastCheck: new Date(),
      status: action.payload.status,
      verificationErrors: action.payload.errors
    };
    state.auditLog.push({
      timestamp: new Date(),
      action: 'VERIFY_BLOCKCHAIN_STATUS',
      status: action.payload.status === 'OPERATIONAL' ? 'SUCCESS' : 'FAILURE',
      details: `Blockchain status: ${action.payload.status}`
    });
  }
});

export default consentReducer;