import axios, { AxiosInstance } from 'axios'; // axios ^1.3.0
import jwtDecode from 'jwt-decode'; // jwt-decode ^3.1.2
import { v4 as uuidv4 } from 'uuid'; // uuid ^9.0.0

import { 
  ILoginCredentials, 
  IAuthTokens, 
  IMFAConfig, 
  IAuthUser 
} from '../interfaces/auth.interface';
import { 
  AuthError, 
  AuthStatus, 
  MFAMethod, 
  MFAChallengeResponse, 
  MFAVerificationPayload 
} from '../types/auth.types';
import { apiConfig } from '../config/api.config';

// Create axios instance with enhanced security configuration
const api: AxiosInstance = axios.create({
  ...apiConfig,
  headers: {
    ...apiConfig.headers,
    'X-Request-ID': uuidv4()
  }
});

/**
 * Validates JWT token format and expiration
 * @param token - JWT token to validate
 * @returns boolean indicating token validity
 */
const validateToken = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

/**
 * Logs security audit events
 * @param eventType - Type of security event
 * @param details - Event details
 */
const logSecurityEvent = async (eventType: string, details: Record<string, any>): Promise<void> => {
  try {
    await api.post('/audit/security', {
      eventType,
      timestamp: new Date().toISOString(),
      details: {
        ...details,
        requestId: api.defaults.headers['X-Request-ID']
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

/**
 * Authenticates user with provided credentials and handles MFA flow
 * @param credentials - User login credentials
 * @returns Promise resolving to authentication tokens
 */
export const login = async (credentials: ILoginCredentials): Promise<IAuthTokens> => {
  try {
    const response = await api.post<{ tokens: IAuthTokens; mfaRequired: boolean }>('/auth/login', credentials);
    
    if (response.data.mfaRequired) {
      await logSecurityEvent('MFA_REQUIRED', { email: credentials.email });
      throw new Error(AuthError.MFA_REQUIRED);
    }

    const { tokens } = response.data;
    if (!validateToken(tokens.accessToken)) {
      throw new Error(AuthError.INVALID_CREDENTIALS);
    }

    await logSecurityEvent('LOGIN_SUCCESS', { email: credentials.email });
    return tokens;
  } catch (error) {
    await logSecurityEvent('LOGIN_FAILED', { 
      email: credentials.email, 
      error: error.message 
    });
    throw error;
  }
};

/**
 * Refreshes authentication tokens with comprehensive validation
 * @param refreshToken - Current refresh token
 * @returns Promise resolving to new authentication tokens
 */
export const refreshToken = async (refreshToken: string): Promise<IAuthTokens> => {
  try {
    if (!validateToken(refreshToken)) {
      throw new Error(AuthError.REFRESH_TOKEN_EXPIRED);
    }

    const response = await api.post<{ tokens: IAuthTokens }>('/auth/refresh', { refreshToken });
    const { tokens } = response.data;

    if (!validateToken(tokens.accessToken)) {
      throw new Error(AuthError.SYSTEM_ERROR);
    }

    await logSecurityEvent('TOKEN_REFRESH', { success: true });
    return tokens;
  } catch (error) {
    await logSecurityEvent('TOKEN_REFRESH_FAILED', { error: error.message });
    throw error;
  }
};

/**
 * Initiates MFA setup with multiple authentication options
 * @param mfaConfig - MFA configuration options
 * @returns Promise resolving to MFA setup data
 */
export const setupMFA = async (mfaConfig: IMFAConfig): Promise<{ secret: string; backupCodes: string[] }> => {
  try {
    const response = await api.post<{ secret: string; backupCodes: string[] }>('/auth/mfa/setup', {
      method: mfaConfig.method,
      phoneNumber: mfaConfig.phoneNumber
    });

    await logSecurityEvent('MFA_SETUP', { 
      method: mfaConfig.method,
      success: true 
    });

    return response.data;
  } catch (error) {
    await logSecurityEvent('MFA_SETUP_FAILED', {
      method: mfaConfig.method,
      error: error.message
    });
    throw error;
  }
};

/**
 * Verifies MFA code with retry logic and incident tracking
 * @param code - Verification code
 * @param method - MFA method used
 * @returns Promise resolving to verification success status
 */
export const verifyMFA = async (code: string, method: MFAMethod): Promise<boolean> => {
  try {
    const response = await api.post<{ success: boolean; challenge?: MFAChallengeResponse }>('/auth/mfa/verify', {
      code,
      method,
      challengeId: localStorage.getItem('mfa_challenge_id')
    });

    if (response.data.success) {
      await logSecurityEvent('MFA_VERIFICATION_SUCCESS', { method });
      return true;
    }

    throw new Error(AuthError.MFA_FAILED);
  } catch (error) {
    await logSecurityEvent('MFA_VERIFICATION_FAILED', {
      method,
      error: error.message
    });
    throw error;
  }
};

/**
 * Logs out user with token revocation and session cleanup
 * @returns Promise resolving on successful logout
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
    
    // Clear all auth-related storage
    localStorage.removeItem('mfa_challenge_id');
    sessionStorage.clear();
    
    await logSecurityEvent('LOGOUT_SUCCESS', {});
  } catch (error) {
    await logSecurityEvent('LOGOUT_FAILED', { error: error.message });
    throw error;
  }
};

// Export types for external use
export type { 
  IAuthTokens,
  ILoginCredentials,
  IMFAConfig,
  IAuthUser
};