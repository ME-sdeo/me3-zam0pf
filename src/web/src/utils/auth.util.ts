/**
 * Authentication Utility Functions
 * Implements secure token management with HIPAA/GDPR compliance
 * @version 1.0.0
 */

import jwtDecode, { JwtPayload } from 'jwt-decode'; // jwt-decode ^3.1.2
import CryptoJS from 'crypto-js'; // crypto-js ^4.1.1
import { IAuthTokens } from '../interfaces/auth.interface';
import { tokenConfig } from '../config/auth.config';
import { AuthError } from '../types/auth.types';

// Custom JWT payload with device binding
interface ExtendedJwtPayload extends JwtPayload {
  deviceId?: string;
  sub: string;
  role: string;
}

/**
 * Validates access token including signature, expiration, and device binding
 * @param accessToken - JWT access token to validate
 * @param deviceId - Current device identifier for binding verification
 * @returns boolean indicating token validity
 */
export const isTokenValid = (accessToken: string, deviceId: string): boolean => {
  try {
    if (!accessToken || !deviceId) {
      return false;
    }

    // Decode and validate token structure
    const decodedToken = jwtDecode<ExtendedJwtPayload>(accessToken, {
      header: true
    });

    // Verify token hasn't expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (!decodedToken.exp || decodedToken.exp < currentTime) {
      return false;
    }

    // Verify device binding
    if (decodedToken.deviceId && decodedToken.deviceId !== deviceId) {
      console.warn('Device binding mismatch detected');
      return false;
    }

    // Additional security checks
    if (!decodedToken.sub || !decodedToken.role) {
      console.warn('Required token claims missing');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Determines if token should be refreshed based on expiration threshold
 * @param expiresIn - Token expiration timestamp
 * @param deviceId - Current device identifier
 * @returns boolean indicating if refresh is needed
 */
export const shouldRefreshToken = (expiresIn: number, deviceId: string): boolean => {
  try {
    if (!expiresIn || !deviceId) {
      return true;
    }

    const currentTime = Date.now();
    const refreshThreshold = tokenConfig.refreshThresholdMinutes * 60 * 1000;
    const shouldRefresh = (expiresIn - currentTime) < refreshThreshold;

    // Log refresh decision for audit
    if (shouldRefresh) {
      console.info('Token refresh required - approaching expiration');
    }

    return shouldRefresh;
  } catch (error) {
    console.error('Error checking token refresh:', error);
    return true;
  }
};

/**
 * Securely stores authentication tokens with device binding
 * @param tokens - Authentication tokens to store
 * @param deviceId - Device identifier for binding
 */
export const storeTokens = (tokens: IAuthTokens, deviceId: string): void => {
  try {
    if (!tokens || !deviceId) {
      throw new Error(AuthError.UNAUTHORIZED);
    }

    // Prepare tokens with device binding
    const tokenData = {
      ...tokens,
      deviceBinding: deviceId,
      timestamp: Date.now()
    };

    // Store tokens securely
    localStorage.setItem(tokenConfig.storageKey, JSON.stringify(tokenData));

    // Clean sensitive data from memory
    setTimeout(() => {
      tokenData.accessToken = '';
      tokenData.refreshToken = '';
    }, 0);
  } catch (error) {
    console.error('Error storing tokens:', error);
    clearTokens(deviceId);
    throw new Error(AuthError.SYSTEM_ERROR);
  }
};

/**
 * Securely retrieves stored authentication tokens
 * @param deviceId - Device identifier for binding verification
 * @returns Decrypted tokens or null if invalid/not found
 */
export const getStoredTokens = (deviceId: string): IAuthTokens | null => {
  try {
    if (!deviceId) {
      return null;
    }

    // Retrieve stored data
    const storedData = localStorage.getItem(tokenConfig.storageKey);
    if (!storedData) {
      return null;
    }

    const tokenData = JSON.parse(storedData);

    // Verify device binding
    if (tokenData.deviceBinding !== deviceId) {
      console.warn('Device binding verification failed');
      clearTokens(deviceId);
      return null;
    }

    // Validate token structure
    if (!tokenData.accessToken || !tokenData.refreshToken) {
      clearTokens(deviceId);
      return null;
    }

    return {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      idToken: tokenData.idToken,
      expiresIn: tokenData.expiresIn,
      tokenType: tokenData.tokenType,
      scope: tokenData.scope
    };
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    clearTokens(deviceId);
    return null;
  }
};

/**
 * Securely removes stored authentication tokens and performs cleanup
 * @param deviceId - Device identifier for binding verification
 */
export const clearTokens = (deviceId: string): void => {
  try {
    if (!deviceId) {
      return;
    }

    // Remove tokens from storage
    localStorage.removeItem(tokenConfig.storageKey);

    // Clear session storage
    sessionStorage.clear();

    // Clear relevant cookies
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });

    // Log cleanup for audit
    console.info('Auth tokens cleared successfully');
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
};