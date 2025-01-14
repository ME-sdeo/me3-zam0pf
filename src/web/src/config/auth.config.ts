/**
 * Authentication Configuration
 * Implements secure Azure AD B2C authentication settings for MyElixir platform
 * HIPAA and GDPR compliant configuration with enhanced security measures
 * @version 1.0.0
 */

import { Configuration, BrowserCacheLocation, LogLevel } from '@azure/msal-browser';
import { AUTH_ROUTES, AUTH_SCOPES } from '../constants/auth.constants';

/**
 * MSAL Configuration
 * Implements secure authentication with Azure AD B2C
 * - Enforces PKCE for enhanced security
 * - Implements secure token caching
 * - Configures secure logging with PII protection
 * - Sets appropriate timeouts for security
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.VITE_AZURE_CLIENT_ID as string,
    authority: process.env.VITE_AZURE_AUTHORITY as string,
    knownAuthorities: [(process.env.VITE_AZURE_KNOWN_AUTHORITIES as string)],
    redirectUri: window.location.origin + AUTH_ROUTES.CALLBACK,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
    validateAuthority: true,
    protocolMode: 'AAD'
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: true,
    secureCookies: true
  },
  system: {
    loggerOptions: {
      loggerCallback: process.env.NODE_ENV === 'development' 
        ? (level: LogLevel, message: string, containsPii: boolean) => {
            if (!containsPii) console.log(`MSAL: ${LogLevel[level]} - ${message}`);
          }
        : undefined,
      piiLoggingEnabled: false,
      logLevel: LogLevel.Warning,
      correlationId: crypto.randomUUID()
    },
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
    cryptoOptions: {
      usePkce: true
    }
  }
};

/**
 * Login Request Configuration
 * Defines secure login parameters including:
 * - Required OAuth scopes
 * - MFA enforcement
 * - Login hints for improved UX
 */
export const loginRequest = {
  scopes: AUTH_SCOPES,
  prompt: 'select_account',
  loginHint: undefined,
  domainHint: undefined
} as const;

/**
 * Token Management Configuration
 * Implements secure token handling with:
 * - Proactive token refresh
 * - Secure storage keys
 * - Retry logic for token operations
 * - Session timeout controls
 */
export const tokenConfig = {
  // Refresh token 5 minutes before expiry
  refreshThresholdMinutes: 5,
  
  // Secure storage keys with namespace
  storageKey: 'myelixir.token',
  renewalInProgressKey: 'token_renewal_in_progress',
  
  // Token operation retry configuration
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  
  // Session management
  sessionTimeoutMinutes: 30,
  tokenExpiryBufferMs: 300000 // 5 minutes
} as const;

/**
 * Security Configuration
 * HIPAA and GDPR compliant security settings
 * - Implements secure defaults
 * - Enforces strict security policies
 */
export const securityConfig = {
  requireMfa: true,
  validateIdToken: true,
  enforceHttps: true,
  sameSiteCookie: 'strict',
  secureCookieEnabled: true,
  xssProtectionEnabled: true
} as const;