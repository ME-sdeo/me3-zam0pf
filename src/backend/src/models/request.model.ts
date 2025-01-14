import { Schema, model, Document } from 'mongoose'; // ^6.0.0
import { 
  DataRequestType, 
  RequestStatus, 
  ComplianceLevel,
  FilterCriteria,
  MIN_PRICE_PER_RECORD,
  MAX_REQUEST_DURATION_DAYS
} from '../types/marketplace.types';
import { FHIRValidationResult } from '../interfaces/fhir.interface';

/**
 * Interface for Request document with Mongoose specific functionality
 */
interface IRequest extends DataRequestType, Document {
  validatePricePerRecord(price: number): boolean;
  validateExpiryDate(date: Date): boolean;
  validateComplianceRequirements(): Promise<FHIRValidationResult>;
}

/**
 * Constants for request model validation and compliance
 */
const MIN_PRIVACY_IMPACT_SCORE = 0.7;
const COMPLIANCE_AUDIT_INTERVAL_DAYS = 7;

/**
 * Enhanced Mongoose schema for data requests with comprehensive compliance tracking
 */
const RequestSchema = new Schema<IRequest>({
  companyId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Company ID is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Request description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  filterCriteria: {
    type: Object as unknown as FilterCriteria,
    required: [true, 'Filter criteria is required'],
    validate: {
      validator: function(criteria: FilterCriteria) {
        return criteria.resourceTypes && 
               criteria.resourceTypes.length > 0 && 
               criteria.demographics &&
               criteria.conditions;
      },
      message: 'Invalid filter criteria structure'
    }
  },
  pricePerRecord: {
    type: Number,
    required: [true, 'Price per record is required'],
    min: [MIN_PRICE_PER_RECORD, `Price must be at least ${MIN_PRICE_PER_RECORD}`],
    validate: {
      validator: function(price: number) {
        return this.validatePricePerRecord(price);
      },
      message: 'Invalid price per record'
    }
  },
  recordsNeeded: {
    type: Number,
    required: [true, 'Number of records needed is required'],
    min: [1, 'Must request at least 1 record'],
    max: [1000000, 'Cannot exceed 1 million records per request']
  },
  status: {
    type: String,
    enum: Object.values(RequestStatus),
    default: RequestStatus.DRAFT,
    required: true,
    index: true
  },
  complianceLevel: {
    type: String,
    enum: Object.values(ComplianceLevel),
    required: [true, 'Compliance level is required'],
    index: true
  },
  auditTrail: [{
    type: Schema.Types.ObjectId,
    ref: 'AuditRecord'
  }],
  privacyImpactScore: {
    type: Number,
    required: true,
    min: [MIN_PRIVACY_IMPACT_SCORE, `Privacy impact score must be at least ${MIN_PRIVACY_IMPACT_SCORE}`],
    default: MIN_PRIVACY_IMPACT_SCORE
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    validate: {
      validator: function(date: Date) {
        return this.validateExpiryDate(date);
      },
      message: 'Invalid expiry date'
    }
  }
}, {
  timestamps: true,
  collection: 'requests',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes for optimized query performance
 */
RequestSchema.index({ companyId: 1, status: 1 });
RequestSchema.index({ createdAt: 1 });
RequestSchema.index({ expiresAt: 1 });
RequestSchema.index({ 'filterCriteria.resourceTypes': 1 });
RequestSchema.index({ complianceLevel: 1, status: 1 });

/**
 * Validates price per record against compliance requirements
 */
RequestSchema.methods.validatePricePerRecord = function(price: number): boolean {
  if (price < MIN_PRICE_PER_RECORD) return false;
  
  // Additional compliance-based pricing validation
  switch (this.complianceLevel) {
    case ComplianceLevel.HIPAA:
    case ComplianceLevel.HITECH:
      return price >= MIN_PRICE_PER_RECORD * 2;
    case ComplianceLevel.GDPR:
      return price >= MIN_PRICE_PER_RECORD * 1.5;
    default:
      return true;
  }
};

/**
 * Validates expiry date against compliance requirements
 */
RequestSchema.methods.validateExpiryDate = function(date: Date): boolean {
  const maxDuration = MAX_REQUEST_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const duration = date.getTime() - this.createdAt.getTime();
  
  if (duration > maxDuration) return false;

  // Compliance-specific duration validation
  switch (this.complianceLevel) {
    case ComplianceLevel.HIPAA:
      return duration <= (maxDuration * 0.75);
    case ComplianceLevel.GDPR:
      return duration <= (maxDuration * 0.5);
    default:
      return true;
  }
};

/**
 * Validates request against compliance requirements
 */
RequestSchema.methods.validateComplianceRequirements = async function(): Promise<FHIRValidationResult> {
  const validationResult: FHIRValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalFields: 0,
      validFields: 0,
      errorCount: 0,
      warningCount: 0,
      successRate: 0
    }
  };

  // Validate privacy impact
  if (this.privacyImpactScore < MIN_PRIVACY_IMPACT_SCORE) {
    validationResult.errors.push({
      type: 'Value',
      path: 'privacyImpactScore',
      message: 'Insufficient privacy impact score'
    });
  }

  // Validate compliance level specific requirements
  switch (this.complianceLevel) {
    case ComplianceLevel.HIPAA:
      // Add HIPAA-specific validation
      break;
    case ComplianceLevel.GDPR:
      // Add GDPR-specific validation
      break;
    case ComplianceLevel.HITECH:
      // Add HITECH-specific validation
      break;
  }

  // Calculate validation statistics
  validationResult.stats.errorCount = validationResult.errors.length;
  validationResult.stats.warningCount = validationResult.warnings.length;
  validationResult.valid = validationResult.errors.length === 0;

  return validationResult;
};

/**
 * Static method to find requests by company
 */
RequestSchema.statics.findByCompany = function(companyId: string) {
  return this.find({ companyId }).sort({ createdAt: -1 });
};

/**
 * Static method to find active requests
 */
RequestSchema.statics.findActiveRequests = function() {
  return this.find({
    status: RequestStatus.ACTIVE,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

/**
 * Static method to update request status with compliance validation
 */
RequestSchema.statics.updateRequestStatus = async function(
  requestId: string,
  status: RequestStatus
) {
  const request = await this.findById(requestId);
  if (!request) throw new Error('Request not found');

  const validationResult = await request.validateComplianceRequirements();
  if (!validationResult.valid) {
    throw new Error('Compliance validation failed');
  }

  request.status = status;
  request.updatedAt = new Date();
  return request.save();
};

// Create and export the Request model
const Request = model<IRequest>('Request', RequestSchema);
export default Request;