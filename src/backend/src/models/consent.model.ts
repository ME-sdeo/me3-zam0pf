/**
 * @fileoverview Mongoose model for HIPAA-compliant consent management with blockchain integration
 * @version 1.0.0
 * @license MIT
 */

import { Schema, model, Model, Document } from 'mongoose'; // ^6.0.0
import {
  IConsent,
  IConsentPermissions,
  ConsentStatus,
  ConsentAccessLevel,
  CONSENT_STATUS_TRANSITIONS,
  VALID_FHIR_RESOURCE_TYPES,
  REQUIRED_PERMISSION_FIELDS
} from '../interfaces/consent.interface';

/**
 * Extended interface for Consent document with Mongoose methods
 */
interface IConsentDocument extends IConsent, Document {
  validateStatusTransition(newStatus: ConsentStatus): boolean;
  verifyBlockchainReference(): Promise<boolean>;
}

/**
 * Extended interface for Consent model with static methods
 */
interface IConsentModel extends Model<IConsentDocument> {
  findByUserId(userId: string): Promise<IConsentDocument[]>;
  updateConsentStatus(consentId: string, status: ConsentStatus): Promise<IConsentDocument>;
}

/**
 * Schema definition for consent records with HIPAA compliance and blockchain integration
 */
const ConsentSchema = new Schema<IConsentDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
        message: 'Invalid UUID format'
      }
    },
    userId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
        message: 'Invalid UUID format'
      }
    },
    companyId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
        message: 'Invalid UUID format'
      }
    },
    requestId: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
        message: 'Invalid UUID format'
      }
    },
    permissions: {
      type: {
        resourceTypes: {
          type: [String],
          required: true,
          validate: {
            validator: (types: string[]) => 
              types.every(type => VALID_FHIR_RESOURCE_TYPES.includes(type)),
            message: 'Invalid FHIR resource type'
          }
        },
        accessLevel: {
          type: String,
          required: true,
          enum: Object.values(ConsentAccessLevel)
        },
        dataElements: {
          type: [String],
          required: true,
          validate: {
            validator: (elements: string[]) => elements.length > 0,
            message: 'At least one data element must be specified'
          }
        },
        purpose: {
          type: String,
          required: true,
          index: 'text',
          minlength: 10
        },
        constraints: {
          timeRestrictions: [{
            startTime: String,
            endTime: String
          }],
          ipRestrictions: [String],
          usageLimit: Number
        }
      },
      required: true,
      validate: {
        validator: (permissions: IConsentPermissions) =>
          REQUIRED_PERMISSION_FIELDS.every(field => permissions[field] !== undefined),
        message: 'Missing required permission fields'
      }
    },
    validFrom: {
      type: Date,
      required: true,
      index: true,
      validate: {
        validator: (date: Date) => date >= new Date(),
        message: 'Valid from date must be in the future'
      }
    },
    validTo: {
      type: Date,
      required: true,
      index: true,
      validate: {
        validator: function(this: IConsentDocument, date: Date) {
          return date > this.validFrom;
        },
        message: 'Valid to date must be after valid from date'
      }
    },
    blockchainRef: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^0x[a-fA-F0-9]{64}$/.test(v),
        message: 'Invalid blockchain reference format'
      }
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ConsentStatus),
      default: ConsentStatus.PENDING,
      index: true
    },
    auditLog: [{
      timestamp: { type: Date, required: true },
      action: { type: String, required: true },
      actor: { type: String, required: true },
      changes: Schema.Types.Mixed
    }]
  },
  {
    timestamps: true,
    collection: 'consents'
  }
);

// Compound indexes for efficient querying
ConsentSchema.index({ userId: 1, status: 1 });
ConsentSchema.index({ companyId: 1, status: 1 });
ConsentSchema.index({ validTo: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance methods
ConsentSchema.methods.validateStatusTransition = function(newStatus: ConsentStatus): boolean {
  const currentStatus = this.status as ConsentStatus;
  const validTransitions = CONSENT_STATUS_TRANSITIONS[currentStatus];
  return validTransitions.includes(newStatus);
};

ConsentSchema.methods.verifyBlockchainReference = async function(): Promise<boolean> {
  // Implementation would verify the transaction exists on the blockchain
  // and matches the consent details
  return true; // Placeholder implementation
};

// Static methods
ConsentSchema.statics.findByUserId = async function(userId: string): Promise<IConsentDocument[]> {
  return this.find({ 
    userId,
    status: { $in: [ConsentStatus.PENDING, ConsentStatus.ACTIVE] }
  }).sort({ createdAt: -1 });
};

ConsentSchema.statics.updateConsentStatus = async function(
  consentId: string,
  status: ConsentStatus
): Promise<IConsentDocument> {
  const consent = await this.findOne({ id: consentId });
  if (!consent) {
    throw new Error('Consent not found');
  }

  if (!consent.validateStatusTransition(status)) {
    throw new Error('Invalid status transition');
  }

  consent.status = status;
  consent.auditLog.push({
    timestamp: new Date(),
    action: `Status updated to ${status}`,
    actor: 'SYSTEM',
    changes: { status: { from: consent.status, to: status } }
  });

  return consent.save();
};

// Middleware for audit logging
ConsentSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    const changes = this.modifiedPaths().reduce((acc, path) => {
      acc[path] = {
        from: this.getChanges()[path],
        to: this.get(path)
      };
      return acc;
    }, {});

    this.auditLog.push({
      timestamp: new Date(),
      action: 'Update',
      actor: 'SYSTEM',
      changes
    });
  }
  next();
});

// Create and export the model
const ConsentModel = model<IConsentDocument, IConsentModel>('Consent', ConsentSchema);
export default ConsentModel;