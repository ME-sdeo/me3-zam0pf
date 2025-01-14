/**
 * Authentication Constants
 * Defines authentication-related constants for MyElixir frontend application
 * Implements HIPAA and GDPR compliant authentication configuration
 * @version 1.0.0
 */

/**
 * Authentication route paths for frontend navigation
 */
export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register', 
  CALLBACK: '/auth/callback',
  LOGOUT: '/auth/logout',
  MFA_SETUP: '/auth/mfa-setup',
  MFA_CHALLENGE: '/auth/mfa-challenge',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_EMAIL: '/auth/verify-email'
} as const;

/**
 * OAuth scopes required for Azure AD B2C authentication and API access
 * Includes scopes for OpenID Connect, user profile, and API permissions
 */
export const AUTH_SCOPES = [
  'openid',
  'profile', 
  'email',
  'offline_access',
  'api://myelixir/user.read',
  'api://myelixir/data.read',
  'api://myelixir/data.write',
  'api://myelixir/consent.manage'
] as const;

/**
 * HIPAA-compliant authentication error messages
 * Provides user-friendly error messages while maintaining security
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  MFA_REQUIRED: 'Multi-factor authentication is required for secure access.',
  MFA_SETUP_REQUIRED: 'Please set up multi-factor authentication to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  EMAIL_VERIFICATION_REQUIRED: 'Please verify your email address to continue.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to multiple failed attempts.',
  GENERAL_ERROR: 'An authentication error occurred. Please try again.'
} as const;

/**
 * Secure storage keys for authentication-related data
 * Uses namespaced keys to prevent conflicts
 */
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'myelixir.auth.access_token',
  REFRESH_TOKEN: 'myelixir.auth.refresh_token',
  ID_TOKEN: 'myelixir.auth.id_token',
  USER_PROFILE: 'myelixir.auth.user_profile',
  MFA_STATE: 'myelixir.auth.mfa_state',
  AUTH_STATE: 'myelixir.auth.state'
} as const;

/**
 * Authentication configuration parameters
 * Defines timeouts and security settings
 * TOKEN_REFRESH_MARGIN: 5 minutes in milliseconds
 * SESSION_TIMEOUT: 1 hour in milliseconds
 * MFA_TIMEOUT: 5 minutes in milliseconds
 * MAX_LOGIN_ATTEMPTS: Maximum failed login attempts before account lockout
 */
export const AUTH_CONFIG = {
  TOKEN_REFRESH_MARGIN: 300000,
  SESSION_TIMEOUT: 3600000,
  MFA_TIMEOUT: 300000,
  MAX_LOGIN_ATTEMPTS: 5
} as const;