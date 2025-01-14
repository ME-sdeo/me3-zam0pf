import { Schema, model, Document } from 'mongoose'; // version: ^6.9.0
import { plugin as mongooseEncryption } from 'mongoose-encryption'; // version: ^2.1.2
import { encryptField } from 'mongoose-field-encryption'; // version: ^4.0.0
import { IUser, UserRole, UserStatus, IUserProfile, IUserAuthInfo, IUserPreferences } from '../interfaces/user.interface';

// Constants for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

// Audit log interface
interface IAuditLog {
  timestamp: Date;
  action: string;
  performedBy: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

// Schema definition with HIPAA compliance
const UserSchema = new Schema<IUser & Document>({
  id: {
    type: String,
    required: true,
    unique: true,
    immutable: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (email: string) => EMAIL_REGEX.test(email),
      message: 'Invalid email format'
    }
  },
  role: {
    type: String,
    required: true,
    enum: Object.values(UserRole),
    default: UserRole.CONSUMER
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING_VERIFICATION
  },
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: (phone: string) => PHONE_REGEX.test(phone),
        message: 'Invalid phone number format'
      }
    },
    address: {
      type: String,
      required: true
    }
  },
  authInfo: {
    userId: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaMethod: {
      type: String,
      enum: ['AUTHENTICATOR', 'SMS', 'EMAIL'],
      default: 'SMS'
    },
    lastLogin: {
      type: Date
    }
  },
  preferences: {
    notificationPreferences: [{
      type: String
    }],
    dataVisibility: [{
      type: String
    }],
    defaultConsentDuration: {
      type: Number,
      default: 30 // 30 days default
    }
  },
  auditLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: String,
    performedBy: String,
    details: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],
  lastModifiedBy: String,
  modifiedReason: String
}, {
  timestamps: true,
  collection: 'users'
});

// Configure field encryption for HIPAA compliance
const encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-for-development';
const signingKey = process.env.SIGNING_KEY || 'fallback-signing-key-for-development';

UserSchema.plugin(mongooseEncryption, {
  encryptionKey,
  signingKey,
  encryptedFields: ['profile.dateOfBirth', 'profile.phone', 'profile.address'],
  additionalAuthenticatedFields: ['email', 'role', 'status']
});

// Pre-save middleware for HIPAA compliance and validation
UserSchema.pre('save', async function(next) {
  if (this.isModified()) {
    // Generate audit log entry
    const auditEntry: IAuditLog = {
      timestamp: new Date(),
      action: this.isNew ? 'CREATE' : 'UPDATE',
      performedBy: this.lastModifiedBy || 'SYSTEM',
      details: this.modifiedPaths().reduce((acc, path) => {
        acc[path] = this.get(path);
        return acc;
      }, {} as Record<string, unknown>),
      ipAddress: '',  // To be set by the service layer
      userAgent: ''   // To be set by the service layer
    };

    this.auditLog = [...(this.auditLog || []), auditEntry];
  }

  next();
});

// Static methods
UserSchema.statics.findByEmail = async function(email: string): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase() });
};

// Instance methods
UserSchema.methods.updateProfile = async function(
  profile: Partial<IUserProfile>,
  modifiedBy: string,
  reason: string
): Promise<IUser> {
  this.profile = { ...this.profile, ...profile };
  this.lastModifiedBy = modifiedBy;
  this.modifiedReason = reason;
  return this.save();
};

// Indexes for performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ 'authInfo.userId': 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: 1 });

// Create and export the model
const UserModel = model<IUser & Document>('User', UserSchema);

export default UserModel;

// Named exports for specific functionality
export const findUserByEmail = UserModel.findByEmail.bind(UserModel);
export const createUser = UserModel.create.bind(UserModel);
export const findUserById = UserModel.findById.bind(UserModel);
export const updateUserProfile = UserModel.prototype.updateProfile;