import { Model, Schema, model } from 'mongoose';
import { Field, encryptField } from 'mongodb-field-encryption';
import { createLogger } from 'winston';
import { TransactionStatus } from '../interfaces/marketplace.interface';
import { PaymentMethodType } from '../interfaces/payment.interface';
import { TransactionType } from '../types/blockchain.types';

// Configure logger for audit trails
const logger = createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'transaction-model' }
});

/**
 * Interface for audit log entries in transactions
 */
interface AuditLogEntry {
  timestamp: Date;
  action: string;
  userId: string;
  details: Record<string, any>;
  ipAddress: string;
}

/**
 * Interface defining the transaction document structure
 */
interface ITransaction {
  id: string;
  requestId: string;
  providerId: string;
  companyId: string;
  resourceIds: string[];
  amount: number;
  paymentMethod: PaymentMethodType;
  status: TransactionStatus;
  paymentIntentId: string;
  blockchainRef: string;
  blockchainTxHash: string;
  createdAt: Date;
  completedAt?: Date;
  lastModifiedAt: Date;
  lastModifiedBy: string;
  auditLog: AuditLogEntry[];
}

/**
 * Schema for transaction audit log entries
 */
const AuditLogSchema = new Schema<AuditLogEntry>({
  timestamp: { type: Date, required: true },
  action: { type: String, required: true },
  userId: { type: String, required: true },
  details: { type: Schema.Types.Mixed, required: true },
  ipAddress: { type: String, required: true }
});

/**
 * Enhanced schema for marketplace transactions with encryption and validation
 */
const TransactionSchema = new Schema<ITransaction>({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  requestId: { 
    type: String, 
    required: true,
    index: true 
  },
  providerId: { 
    type: String, 
    required: true,
    index: true 
  },
  companyId: { 
    type: String, 
    required: true,
    index: true 
  },
  resourceIds: [{ 
    type: String, 
    required: true 
  }],
  amount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  paymentMethod: { 
    type: String, 
    required: true,
    enum: Object.values(PaymentMethodType)
  },
  status: { 
    type: String, 
    required: true,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.INITIATED
  },
  paymentIntentId: { 
    type: String, 
    required: true,
    encrypted: true // Field-level encryption
  },
  blockchainRef: { 
    type: String,
    sparse: true
  },
  blockchainTxHash: { 
    type: String,
    sparse: true
  },
  createdAt: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  completedAt: { 
    type: Date 
  },
  lastModifiedAt: { 
    type: Date,
    required: true,
    default: Date.now 
  },
  lastModifiedBy: { 
    type: String,
    required: true 
  },
  auditLog: [AuditLogSchema]
}, {
  timestamps: true,
  collection: 'transactions'
});

// Add field-level encryption for sensitive data
encryptField(TransactionSchema, ['paymentIntentId']);

// Add indexes for common queries
TransactionSchema.index({ requestId: 1, status: 1 });
TransactionSchema.index({ providerId: 1, createdAt: -1 });
TransactionSchema.index({ companyId: 1, status: 1 });

/**
 * Pre-save middleware for audit logging and timestamp updates
 */
TransactionSchema.pre('save', function(next) {
  this.lastModifiedAt = new Date();
  
  logger.info('Transaction update', {
    transactionId: this.id,
    status: this.status,
    modifiedBy: this.lastModifiedBy
  });
  
  next();
});

/**
 * Enhanced transaction model with security and compliance features
 */
export class TransactionModel extends Model<ITransaction> {
  /**
   * Find transactions by request ID with security validation
   */
  static async findByRequestId(requestId: string): Promise<ITransaction[]> {
    logger.debug('Finding transactions by requestId', { requestId });
    
    return this.find({ 
      requestId,
      status: { $ne: TransactionStatus.FAILED }
    }).sort({ createdAt: -1 });
  }

  /**
   * Find transactions by provider ID with HIPAA compliance
   */
  static async findByProviderId(providerId: string): Promise<ITransaction[]> {
    logger.debug('Finding transactions by providerId', { providerId });
    
    return this.find({ 
      providerId,
      status: { $in: [TransactionStatus.COMPLETED, TransactionStatus.PROCESSING] }
    }).select('-paymentIntentId'); // Exclude sensitive data
  }

  /**
   * Update transaction status with blockchain record
   */
  static async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    blockchainRef?: string
  ): Promise<ITransaction | null> {
    logger.info('Updating transaction status', { 
      transactionId, 
      status,
      blockchainRef 
    });

    const updateData: Partial<ITransaction> = {
      status,
      lastModifiedAt: new Date()
    };

    if (status === TransactionStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (blockchainRef) {
      updateData.blockchainRef = blockchainRef;
    }

    return this.findOneAndUpdate(
      { id: transactionId },
      { $set: updateData },
      { new: true }
    );
  }
}

// Register the model
export default model<ITransaction>('Transaction', TransactionSchema);