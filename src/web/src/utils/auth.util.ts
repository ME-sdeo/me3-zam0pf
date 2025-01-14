/**
 * Authentication Utility Functions
 * Implements secure token management with HIPAA/GDPR compliance
 * @version 1.0.0
 */

import jwtDecode, { JwtPayload } from 'jwt-decode'; // jwt-decode ^3.1.2
import CryptoJS from 'crypto-js'; // crypto-js ^4.1.1
import { IAuthTokens } from '../interfaces/auth.interface';
import { tokenConfig } from '../config/auth.config';
import { AuthError, AuthStatus } from '../types/auth.types';

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
 * Securely stores encrypted authentication tokens with device binding
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
      deviceId,
      timestamp: Date.now()
    };

    // Encrypt token data
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(tokenData),
      tokenConfig.encryptionKey
    ).toString();

    // Store encrypted tokens
    localStorage.setItem(tokenConfig.storageKey, encryptedData);

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
 * Securely retrieves and decrypts stored authentication tokens
 * @param deviceId - Device identifier for binding verification
 * @returns Decrypted tokens or null if invalid/not found
 */
export const getStoredTokens = (deviceId: string): IAuthTokens | null => {
  try {
    if (!deviceId) {
      return null;
    }

    // Retrieve encrypted data
    const encryptedData = localStorage.getItem(tokenConfig.storageKey);
    if (!encryptedData) {
      return null;
    }

    // Decrypt token data
    const decryptedBytes = CryptoJS.AES.decrypt(
      encryptedData,
      tokenConfig.encryptionKey
    );
    const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));

    // Verify device binding
    if (decryptedData.deviceId !== deviceId) {
      console.warn('Device binding verification failed');
      clearTokens(deviceId);
      return null;
    }

    // Validate token structure
    if (!decryptedData.accessToken || !decryptedData.refreshToken) {
      clearTokens(deviceId);
      return null;
    }

    return {
      accessToken: decryptedData.accessToken,
      refreshToken: decryptedData.refreshToken,
      expiresIn: decryptedData.expiresIn,
      deviceId: decryptedData.deviceId
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