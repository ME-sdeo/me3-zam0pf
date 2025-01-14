import { Context, Contract, Info, Transaction } from '@hyperledger/fabric-contract-api'; // v2.2.0
import { BlockchainTransaction, TransactionType } from '../../types/blockchain.types';

/**
 * Interface for HIPAA compliance metadata
 */
interface HIPAAMetadata {
  coveredEntity: string;
  requiredDisclosure: boolean;
  minimumNecessary: boolean;
  securitySafeguards: string[];
  auditTrail: string;
}

/**
 * Interface for GDPR compliance metadata
 */
interface GDPRMetadata {
  legalBasis: string;
  dataSubjectConsent: boolean;
  processingPurpose: string;
  retentionPeriod: number;
  dataProtectionMeasures: string[];
}

/**
 * Interface for transaction query options
 */
interface QueryOptions {
  startDate?: Date;
  endDate?: Date;
  transactionType?: TransactionType;
  pageSize?: number;
  pageNumber?: number;
}

/**
 * Interface for paginated transaction response
 */
interface PaginatedTransactionResponse {
  transactions: BlockchainTransaction[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
}

/**
 * Smart contract for managing HIPAA/GDPR-compliant healthcare data marketplace transactions
 */
@Info({
  title: 'TransactionContract',
  description: 'Smart contract for MyElixir transaction management with compliance features'
})
export class TransactionContract extends Contract {
  // Store for blockchain transactions
  private transactionStore: Map<string, BlockchainTransaction>;
  
  // Index for quick lookup of entity transactions
  private entityTransactionIndex: Map<string, string[]>;
  
  // Maximum retention period for transactions (in days)
  private readonly maxTransactionRetention: number = 2555; // 7 years for HIPAA compliance

  constructor() {
    super('TransactionContract');
    this.transactionStore = new Map<string, BlockchainTransaction>();
    this.entityTransactionIndex = new Map<string, string[]>();
  }

  /**
   * Records a new transaction with compliance metadata on the blockchain
   * @param ctx - The transaction context
   * @param transaction - The transaction to record
   * @throws {Error} If transaction validation fails
   */
  @Transaction()
  public async recordTransaction(
    ctx: Context,
    transaction: BlockchainTransaction & { hipaaMetadata: HIPAAMetadata, gdprMetadata: GDPRMetadata }
  ): Promise<void> {
    // Validate transaction parameters
    if (!transaction.transactionId || !transaction.type) {
      throw new Error('Invalid transaction parameters');
    }

    // Verify HIPAA compliance
    this.validateHIPAACompliance(transaction.hipaaMetadata);

    // Verify GDPR compliance
    this.validateGDPRCompliance(transaction.gdprMetadata);

    // Set transaction timestamp
    transaction.timestamp = new Date();

    // Generate composite key for the transaction
    const txKey = ctx.stub.createCompositeKey('transaction', [
      transaction.transactionId,
      transaction.type
    ]);

    // Convert transaction to buffer for storage
    const txBuffer = Buffer.from(JSON.stringify(transaction));

    // Store transaction in world state
    await ctx.stub.putState(txKey, txBuffer);

    // Update entity transaction index
    this.updateEntityIndex(transaction);

    // Emit transaction event
    await ctx.stub.setEvent('TransactionRecorded', txBuffer);

    // Log compliance verification
    await this.logComplianceAudit(ctx, transaction);
  }

  /**
   * Retrieves filtered transaction history with compliance data
   * @param ctx - The transaction context
   * @param entityId - ID of the entity to query transactions for
   * @param options - Query options for filtering and pagination
   * @returns Paginated array of compliant transactions
   */
  @Transaction(false)
  public async queryTransactionHistory(
    ctx: Context,
    entityId: string,
    options: QueryOptions
  ): Promise<PaginatedTransactionResponse> {
    // Validate entity ID
    if (!entityId) {
      throw new Error('Entity ID is required');
    }

    // Get transaction IDs for the entity
    const txIds = this.entityTransactionIndex.get(entityId) || [];

    // Query and filter transactions
    const transactions = await Promise.all(
      txIds.map(async (txId) => {
        const txKey = ctx.stub.createCompositeKey('transaction', [txId]);
        const txBuffer = await ctx.stub.getState(txKey);
        return JSON.parse(txBuffer.toString()) as BlockchainTransaction;
      })
    );

    // Apply date range filter
    let filteredTx = transactions.filter(tx => {
      const txDate = new Date(tx.timestamp);
      return (!options.startDate || txDate >= options.startDate) &&
             (!options.endDate || txDate <= options.endDate);
    });

    // Apply transaction type filter
    if (options.transactionType) {
      filteredTx = filteredTx.filter(tx => tx.type === options.transactionType);
    }

    // Apply pagination
    const pageSize = options.pageSize || 10;
    const pageNumber = options.pageNumber || 1;
    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedTx = filteredTx.slice(startIndex, startIndex + pageSize);

    // Generate audit log for query
    await this.logQueryAudit(ctx, entityId, options);

    return {
      transactions: paginatedTx,
      totalCount: filteredTx.length,
      pageSize,
      pageNumber
    };
  }

  /**
   * Validates HIPAA compliance metadata
   * @param metadata - HIPAA compliance metadata to validate
   * @throws {Error} If compliance validation fails
   */
  private validateHIPAACompliance(metadata: HIPAAMetadata): void {
    if (!metadata.coveredEntity || !metadata.securitySafeguards?.length) {
      throw new Error('Invalid HIPAA compliance metadata');
    }
    
    if (!metadata.minimumNecessary) {
      throw new Error('Transaction does not meet minimum necessary requirement');
    }
  }

  /**
   * Validates GDPR compliance metadata
   * @param metadata - GDPR compliance metadata to validate
   * @throws {Error} If compliance validation fails
   */
  private validateGDPRCompliance(metadata: GDPRMetadata): void {
    if (!metadata.legalBasis || !metadata.processingPurpose) {
      throw new Error('Invalid GDPR compliance metadata');
    }

    if (!metadata.dataSubjectConsent) {
      throw new Error('Missing data subject consent');
    }

    if (metadata.retentionPeriod > this.maxTransactionRetention) {
      throw new Error('Retention period exceeds maximum allowed duration');
    }
  }

  /**
   * Updates the entity transaction index
   * @param transaction - Transaction to index
   */
  private updateEntityIndex(transaction: BlockchainTransaction): void {
    const entityIds = [transaction.userId, transaction.companyId];
    
    entityIds.forEach(entityId => {
      const existingTx = this.entityTransactionIndex.get(entityId) || [];
      existingTx.push(transaction.transactionId);
      this.entityTransactionIndex.set(entityId, existingTx);
    });
  }

  /**
   * Logs compliance audit information
   * @param ctx - The transaction context
   * @param transaction - Transaction being audited
   */
  private async logComplianceAudit(
    ctx: Context,
    transaction: BlockchainTransaction
  ): Promise<void> {
    const auditEvent = {
      timestamp: new Date(),
      transactionId: transaction.transactionId,
      type: TransactionType.COMPLIANCE_AUDIT,
      details: {
        hipaaVerified: true,
        gdprVerified: true,
        auditTrail: `Compliance verified for transaction ${transaction.transactionId}`
      }
    };

    await ctx.stub.setEvent('ComplianceAudit', Buffer.from(JSON.stringify(auditEvent)));
  }

  /**
   * Logs query audit information
   * @param ctx - The transaction context
   * @param entityId - Entity ID being queried
   * @param options - Query options used
   */
  private async logQueryAudit(
    ctx: Context,
    entityId: string,
    options: QueryOptions
  ): Promise<void> {
    const queryAudit = {
      timestamp: new Date(),
      entityId,
      queryOptions: options,
      accessType: 'HISTORY_QUERY'
    };

    await ctx.stub.setEvent('QueryAudit', Buffer.from(JSON.stringify(queryAudit)));
  }
}

export default TransactionContract;