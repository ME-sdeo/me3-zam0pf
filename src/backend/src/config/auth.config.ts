// @ts-check

import { config } from 'dotenv'; // version: 16.x
import { IAuthTokens } from '../interfaces/auth.interface';

// Load environment variables
config();

/**
 * Validates all required authentication configuration values and ensures HIPAA compliance
 * @throws {Error} If configuration is invalid or non-compliant
 */
function validateAuthConfig(): void {
  const requiredEnvVars = [
    'AZURE_AD_B2C_TENANT_NAME',
    'AZURE_AD_B2C_CLIENT_ID',
    'AZURE_AD_B2C_CLIENT_SECRET',
    'AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY',
    'AZURE_AD_B2C_RESET_PASSWORD_POLICY',
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate JWT secret strength
  const minSecretLength = 32;
  if (process.env.JWT_ACCESS_TOKEN_SECRET!.length < minSecretLength ||
      process.env.JWT_REFRESH_TOKEN_SECRET!.length < minSecretLength) {
    throw new Error('JWT secrets must be at least 32 characters long for HIPAA compliance');
  }
}

// Validate configuration on module load
validateAuthConfig();

/**
 * Comprehensive authentication configuration object
 * Implements HIPAA-compliant security controls and Azure AD B2C integration
 */
export const authConfig = {
  // Azure AD B2C Configuration
  azureADB2C: {
    tenantName: process.env.AZURE_AD_B2C_TENANT_NAME!,
    clientId: process.env.AZURE_AD_B2C_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_B2C_CLIENT_SECRET!,
    signUpSignInPolicyId: process.env.AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY!,
    resetPasswordPolicyId: process.env.AZURE_AD_B2C_RESET_PASSWORD_POLICY!,
    editProfilePolicyId: process.env.AZURE_AD_B2C_EDIT_PROFILE_POLICY!,
    redirectUri: process.env.AZURE_AD_B2C_REDIRECT_URI!,
    scopes: [
      'offline_access',
      'openid',
      'profile',
      'fhir-api',
      'data-consent',
      'marketplace-access'
    ],
    claims: {
      userType: 'extension_userType',
      organizationId: 'extension_orgId',
      dataAccess: 'extension_dataAccess',
      hipaaAgreement: 'extension_hipaaAgreed'
    }
  },

  // JWT Configuration
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET!,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET!,
    accessTokenExpiration: 900, // 15 minutes in seconds
    refreshTokenExpiration: 86400, // 24 hours in seconds
    issuer: 'myElixir',
    audience: 'myElixir-api',
    rotationPolicy: {
      enabled: true,
      maximumLifetime: 604800, // 7 days in seconds
      reusePeriodUntil: 86400  // 24 hours in seconds
    },
    validation: {
      validateIssuer: true,
      validateAudience: true,
      validateLifetime: true,
      clockSkew: 300 // 5 minutes in seconds
    }
  },

  // Multi-Factor Authentication Configuration
  mfa: {
    enabled: true,
    required: true,
    methods: ['authenticator', 'sms', 'email', 'backup-codes'],
    authenticatorIssuer: 'MyElixir',
    smsProvider: {
      name: process.env.SMS_PROVIDER!,
      apiKey: process.env.SMS_API_KEY!,
      backupProvider: process.env.SMS_BACKUP_PROVIDER!,
      backupApiKey: process.env.SMS_BACKUP_API_KEY!
    },
    emailService: {
      provider: process.env.EMAIL_SERVICE!,
      apiKey: process.env.EMAIL_API_KEY!,
      backupProvider: process.env.EMAIL_BACKUP_SERVICE!,
      backupApiKey: process.env.EMAIL_BACKUP_API_KEY!
    },
    tokenValidityMinutes: 5,
    maxAttempts: 3,
    cooldownMinutes: 15,
    progressiveDelay: {
      enabled: true,
      baseDelay: 5,    // Base delay in seconds
      maxDelay: 30,    // Maximum delay in seconds
      multiplier: 2    // Exponential backoff multiplier
    },
    backupCodes: {
      count: 10,
      length: 10,
      algorithm: 'sha256'
    }
  },

  // Security Controls
  security: {
    ipWhitelist: process.env.IP_WHITELIST,
    geoRestrictions: {
      enabled: true,
      allowedCountries: process.env.ALLOWED_COUNTRIES
    },
    sessionTracking: {
      enabled: true,
      maxConcurrentSessions: 3,
      forceLogoutOnMaxExceeded: true
    },
    emergencyAccess: {
      enabled: true,
      approvers: process.env.EMERGENCY_APPROVERS,
      validityHours: 4
    }
  },

  // Audit Logging Configuration
  audit: {
    enabled: true,
    detailedLogging: true,
    logRetentionDays: 365, // HIPAA requires minimum 6 years
    sensitiveFields: ['password', 'token', 'secret'],
    breachNotification: {
      enabled: true,
      notificationEndpoint: process.env.BREACH_NOTIFICATION_ENDPOINT,
      responsibleParty: process.env.SECURITY_CONTACT
    }
  }
};

// Type assertion to ensure configuration matches expected interface
export default authConfig as Readonly<typeof authConfig>;