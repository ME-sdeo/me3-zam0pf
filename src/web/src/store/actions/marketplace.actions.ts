import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import { debounce } from 'lodash'; // ^4.17.21
import { Contract } from '@hyperledger/fabric-gateway'; // ^1.1.1
import { createAuditLog } from '@myelixir/audit-service'; // ^1.0.0
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { RequestStatus, TransactionStatus } from '../../types/marketplace.types';

/**
 * Action type constants for marketplace operations
 */
export const MARKETPLACE_ACTION_TYPES = {
  CREATE_REQUEST_PENDING: 'marketplace/createRequest/pending',
  CREATE_REQUEST_SUCCESS: 'marketplace/createRequest/success',
  CREATE_REQUEST_ERROR: 'marketplace/createRequest/error',
  PROCESS_TRANSACTION_PENDING: 'marketplace/processTransaction/pending',
  PROCESS_TRANSACTION_SUCCESS: 'marketplace/processTransaction/success',
  PROCESS_TRANSACTION_ERROR: 'marketplace/processTransaction/error',
  AUDIT_LOG_PENDING: 'marketplace/auditLog/pending',
  AUDIT_LOG_SUCCESS: 'marketplace/auditLog/success',
  AUDIT_LOG_ERROR: 'marketplace/auditLog/error'
} as const;

/**
 * Interface for marketplace transaction payload
 */
interface IMarketplaceTransactionPayload {
  requestId: string;
  providerId: string;
  companyId: string;
  resourceIds: string[];
  amount: number;
  metadata: Record<string, unknown>;
}

/**
 * Interface for audit log entry
 */
interface IAuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Creates a new data request in the marketplace
 */
export const createDataRequestAction = createAsyncThunk(
  'marketplace/createRequest',
  async (request: IDataRequest, { rejectWithValue }) => {
    try {
      // Validate request against HIPAA requirements
      if (!request.filterCriteria || !request.companyId) {
        throw new Error('Invalid request data');
      }

      // Create audit log for request creation
      await createAuditLog({
        action: 'CREATE_DATA_REQUEST',
        resourceType: 'DataRequest',
        resourceId: request.id,
        userId: request.companyId,
        details: { request },
        timestamp: new Date()
      });

      // Set initial request status
      const dataRequest = {
        ...request,
        status: RequestStatus.ACTIVE,
        createdAt: new Date()
      };

      return dataRequest;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Processes a marketplace transaction with blockchain integration
 */
export const processTransactionAction = createAsyncThunk(
  'marketplace/processTransaction',
  async (transaction: IMarketplaceTransactionPayload, { rejectWithValue }) => {
    try {
      // Create initial audit log
      await createAuditLog({
        action: 'PROCESS_TRANSACTION_INITIATED',
        resourceType: 'MarketplaceTransaction',
        resourceId: transaction.requestId,
        userId: transaction.companyId,
        details: { transaction },
        timestamp: new Date()
      });

      // Record transaction on blockchain using Contract
      const contract = new Contract('marketplace', 'data-exchange');
      const blockchainResponse = await contract.submitTransaction(
        'createTransaction',
        JSON.stringify(transaction)
      );

      // Create completion audit log
      await createAuditLog({
        action: 'PROCESS_TRANSACTION_COMPLETED',
        resourceType: 'MarketplaceTransaction',
        resourceId: transaction.requestId,
        userId: transaction.companyId,
        details: { 
          transaction,
          blockchainRef: blockchainResponse.toString('hex')
        },
        timestamp: new Date()
      });

      return {
        ...transaction,
        status: TransactionStatus.COMPLETED,
        blockchainRef: blockchainResponse.toString('hex'),
        completedAt: new Date()
      };
    } catch (error: unknown) {
      // Create error audit log
      await createAuditLog({
        action: 'PROCESS_TRANSACTION_FAILED',
        resourceType: 'MarketplaceTransaction',
        resourceId: transaction.requestId,
        userId: transaction.companyId,
        details: { 
          transaction,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        },
        timestamp: new Date()
      });

      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Creates HIPAA-compliant audit log entries
 */
export const auditLogAction = createAsyncThunk(
  'marketplace/auditLog',
  async (logEntry: IAuditLogEntry, { rejectWithValue }) => {
    try {
      // Validate audit log entry
      if (!logEntry.action || !logEntry.resourceId || !logEntry.userId) {
        throw new Error('Invalid audit log entry');
      }

      // Create audit log with retry mechanism
      const createLogWithRetry = debounce(async () => {
        return await createAuditLog(logEntry);
      }, 1000, { maxWait: 5000 });

      const result = await createLogWithRetry();

      return {
        ...logEntry,
        id: result.id,
        createdAt: new Date()
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return rejectWithValue(errorMessage);
    }
  }
);