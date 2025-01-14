import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { IDataRequest, IDataMatch } from '../../interfaces/marketplace.interface';
import { MARKETPLACE_ACTION_TYPES } from '../actions/marketplace.actions';
import { UUID } from 'crypto'; // latest

/**
 * Enhanced interface for marketplace state with HIPAA compliance and blockchain support
 */
export interface MarketplaceState {
  requests: Record<UUID, IDataRequest>;
  matches: Record<UUID, IDataMatch[]>;
  loading: boolean;
  error: string | null;
  selectedRequestId: UUID | null;
  blockchainStatus: Record<UUID, {
    transactionHash: string;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    timestamp: Date;
    retryCount: number;
  }>;
  auditTrail: Record<UUID, Array<{
    action: string;
    timestamp: Date;
    userId: UUID;
    details: Record<string, unknown>;
  }>>;
}

/**
 * Initial state with HIPAA-compliant structure
 */
const initialState: MarketplaceState = {
  requests: {},
  matches: {},
  loading: false,
  error: null,
  selectedRequestId: null,
  blockchainStatus: {},
  auditTrail: {}
};

/**
 * Constants for marketplace business rules
 */
const MATCH_SCORE_THRESHOLD = 0.75;
const AUDIT_RETENTION_DAYS = 2555; // 7 years for HIPAA compliance
const BLOCKCHAIN_RETRY_ATTEMPTS = 3;

/**
 * Enhanced marketplace reducer with HIPAA compliance and blockchain support
 */
export const marketplaceReducer = createReducer(initialState, (builder) => {
  builder
    // Handle request creation
    .addCase(MARKETPLACE_ACTION_TYPES.CREATE_REQUEST_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(
      MARKETPLACE_ACTION_TYPES.CREATE_REQUEST_SUCCESS,
      (state, action: PayloadAction<IDataRequest>) => {
        const request = action.payload;
        
        // Store request with HIPAA-compliant audit trail
        state.requests[request.id] = request;
        state.auditTrail[request.id] = [{
          action: 'REQUEST_CREATED',
          timestamp: new Date(),
          userId: request.companyId,
          details: {
            requestId: request.id,
            filterCriteria: request.filterCriteria
          }
        }];
        
        state.loading = false;
      }
    )
    .addCase(
      MARKETPLACE_ACTION_TYPES.CREATE_REQUEST_ERROR,
      (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.error = action.payload;
      }
    )
    
    // Handle blockchain transaction updates
    .addCase(
      MARKETPLACE_ACTION_TYPES.PROCESS_TRANSACTION_PENDING,
      (state, action: PayloadAction<{ requestId: UUID }>) => {
        const { requestId } = action.payload;
        state.blockchainStatus[requestId] = {
          transactionHash: '',
          status: 'PENDING',
          timestamp: new Date(),
          retryCount: 0
        };
      }
    )
    .addCase(
      MARKETPLACE_ACTION_TYPES.PROCESS_TRANSACTION_SUCCESS,
      (state, action: PayloadAction<{
        requestId: UUID;
        transactionHash: string;
      }>) => {
        const { requestId, transactionHash } = action.payload;
        
        // Update blockchain status with transaction confirmation
        state.blockchainStatus[requestId] = {
          ...state.blockchainStatus[requestId],
          transactionHash,
          status: 'CONFIRMED',
          timestamp: new Date()
        };

        // Add to audit trail
        state.auditTrail[requestId].push({
          action: 'BLOCKCHAIN_TRANSACTION_CONFIRMED',
          timestamp: new Date(),
          userId: state.requests[requestId].companyId,
          details: {
            transactionHash,
            requestId
          }
        });
      }
    )
    .addCase(
      MARKETPLACE_ACTION_TYPES.PROCESS_TRANSACTION_ERROR,
      (state, action: PayloadAction<{
        requestId: UUID;
        error: string;
      }>) => {
        const { requestId, error } = action.payload;
        const currentStatus = state.blockchainStatus[requestId];

        // Handle retry logic for blockchain transactions
        if (currentStatus.retryCount < BLOCKCHAIN_RETRY_ATTEMPTS) {
          state.blockchainStatus[requestId] = {
            ...currentStatus,
            status: 'PENDING',
            retryCount: currentStatus.retryCount + 1,
            timestamp: new Date()
          };
        } else {
          state.blockchainStatus[requestId] = {
            ...currentStatus,
            status: 'FAILED',
            timestamp: new Date()
          };

          // Add failure to audit trail
          state.auditTrail[requestId].push({
            action: 'BLOCKCHAIN_TRANSACTION_FAILED',
            timestamp: new Date(),
            userId: state.requests[requestId].companyId,
            details: {
              error,
              requestId,
              retryCount: BLOCKCHAIN_RETRY_ATTEMPTS
            }
          });
        }
      }
    )

    // Handle audit log updates
    .addCase(
      MARKETPLACE_ACTION_TYPES.AUDIT_LOG_SUCCESS,
      (state, action: PayloadAction<{
        requestId: UUID;
        entry: {
          action: string;
          timestamp: Date;
          userId: UUID;
          details: Record<string, unknown>;
        };
      }>) => {
        const { requestId, entry } = action.payload;
        
        // Maintain HIPAA-compliant audit trail
        if (!state.auditTrail[requestId]) {
          state.auditTrail[requestId] = [];
        }

        state.auditTrail[requestId].push(entry);

        // Prune old audit records beyond retention period
        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() - AUDIT_RETENTION_DAYS);
        
        state.auditTrail[requestId] = state.auditTrail[requestId].filter(
          record => record.timestamp > retentionDate
        );
      }
    );
});

export default marketplaceReducer;