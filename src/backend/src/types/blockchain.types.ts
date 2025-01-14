import { Context } from '@hyperledger/fabric-contract-api'; // v2.2.0

/**
 * Enum defining the types of transactions that can be recorded on the blockchain
 * for audit and tracking purposes in the MyElixir healthcare data marketplace
 */
export enum TransactionType {
    CONSENT_GRANTED = 'CONSENT_GRANTED',
    CONSENT_REVOKED = 'CONSENT_REVOKED',
    DATA_ACCESSED = 'DATA_ACCESSED',
    PAYMENT_PROCESSED = 'PAYMENT_PROCESSED'
}

/**
 * Interface defining the structure of blockchain transaction records
 * Used to maintain an immutable ledger of all data access and consent activities
 */
export interface BlockchainTransaction {
    /** Unique identifier for the transaction */
    transactionId: string;
    
    /** Timestamp when the transaction was recorded */
    timestamp: Date;
    
    /** Type of transaction from TransactionType enum */
    type: TransactionType;
    
    /** ID of the user involved in the transaction */
    userId: string;
    
    /** ID of the company involved in the transaction */
    companyId: string;
    
    /** Additional transaction-specific metadata */
    metadata: Record<string, any>;
}

/**
 * Enum defining the available chaincode function names for smart contract interactions
 * Maps to implemented functions in the Hyperledger Fabric chaincode
 */
export enum ChaincodeFunctionName {
    CREATE_CONSENT = 'createConsent',
    UPDATE_CONSENT = 'updateConsentStatus',
    RECORD_TRANSACTION = 'recordTransaction',
    QUERY_HISTORY = 'queryTransactionHistory'
}

/**
 * Custom error class for blockchain-related errors
 * Provides detailed error information for debugging and error handling
 */
export class BlockchainError extends Error {
    public readonly code: string;
    public readonly details: Record<string, any>;

    /**
     * Creates a new BlockchainError instance
     * @param code - Error code identifying the type of error
     * @param message - Human-readable error message
     * @param details - Additional error context and details
     */
    constructor(code: string, message: string, details: Record<string, any>) {
        super(message);
        this.code = code;
        this.details = details;

        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, BlockchainError.prototype);

        // Capture stack trace for debugging
        Error.captureStackTrace(this, BlockchainError);
    }
}

/**
 * Re-export Context type from Hyperledger Fabric for convenience
 * Used for smart contract context in chaincode functions
 */
export { Context as BlockchainContext };