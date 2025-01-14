/**
 * @fileoverview Consent Management API Client
 * Implements HIPAA/GDPR-compliant consent operations with blockchain verification
 * @version 1.0.0
 */

import apiService from '../services/api.service';
import { 
  IConsent, 
  IConsentPermissions, 
  ConsentStatus, 
  IConsentValidation,
  ValidationSeverity,
  EncryptionLevel
} from '../interfaces/consent.interface';
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Creates a new consent record with blockchain verification and encryption
 * @param consentData - Consent data including permissions and constraints
 * @returns Promise resolving to created consent record with blockchain reference
 */
export const grantConsent = async (consentData: Omit<IConsent, 'id' | 'blockchainRef'>): Promise<IConsent> => {
  try {
    // Validate consent data structure
    const validation = await validateConsentData(consentData);
    if (!validation.isValid) {
      throw new Error(`Invalid consent data: ${validation.errors.join(', ')}`);
    }

    // Ensure encryption level is set
    const enhancedData = {
      ...consentData,
      permissions: {
        ...consentData.permissions,
        encryptionLevel: consentData.permissions.encryptionLevel || EncryptionLevel.FIELD_LEVEL
      }
    };

    const response = await apiService.post<IConsent>(
      API_ENDPOINTS.CONSENT.GRANT,
      enhancedData,
      {
        requiresAuth: true,
        headers: {
          'X-Encryption-Level': enhancedData.permissions.encryptionLevel
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error granting consent:', error);
    throw error;
  }
};

/**
 * Revokes an existing consent record with blockchain verification
 * @param consentId - UUID of consent to revoke
 * @returns Promise resolving to void on successful revocation
 */
export const revokeConsent = async (consentId: string): Promise<void> => {
  try {
    await apiService.delete(
      `${API_ENDPOINTS.CONSENT.REVOKE}/${consentId}`,
      {
        requiresAuth: true,
        headers: {
          'X-Revocation-Reason': 'USER_REQUESTED'
        }
      }
    );
  } catch (error) {
    console.error('Error revoking consent:', error);
    throw error;
  }
};

/**
 * Retrieves current status of a consent record with blockchain verification
 * @param consentId - UUID of consent to check
 * @returns Promise resolving to current consent status
 */
export const getConsentStatus = async (consentId: string): Promise<ConsentStatus> => {
  try {
    const response = await apiService.get<{ status: ConsentStatus }>(
      `${API_ENDPOINTS.CONSENT.STATUS}/${consentId}`,
      {
        requiresAuth: true,
        skipCache: true // Always get fresh status
      }
    );
    return response.data.status;
  } catch (error) {
    console.error('Error getting consent status:', error);
    throw error;
  }
};

/**
 * Updates permissions for an existing consent record with blockchain tracking
 * @param consentId - UUID of consent to update
 * @param permissions - New permission settings
 * @returns Promise resolving to updated consent record
 */
export const updateConsentPermissions = async (
  consentId: string,
  permissions: IConsentPermissions
): Promise<IConsent> => {
  try {
    // Validate new permissions
    const validation = await validatePermissions(permissions);
    if (!validation.isValid) {
      throw new Error(`Invalid permissions: ${validation.errors.join(', ')}`);
    }

    const response = await apiService.put<IConsent>(
      `${API_ENDPOINTS.CONSENT.GRANT}/${consentId}`,
      { permissions },
      {
        requiresAuth: true,
        headers: {
          'X-Encryption-Level': permissions.encryptionLevel
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating consent permissions:', error);
    throw error;
  }
};

/**
 * Retrieves all consent records for the current user with blockchain verification
 * @returns Promise resolving to list of user's consent records
 */
export const getUserConsents = async (): Promise<IConsent[]> => {
  try {
    const response = await apiService.get<IConsent[]>(
      API_ENDPOINTS.CONSENT.GRANT,
      {
        requiresAuth: true,
        headers: {
          'X-Include-Metadata': 'true',
          'X-Include-History': 'true'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting user consents:', error);
    throw error;
  }
};

/**
 * Validates consent data structure and permissions
 * @param consentData - Consent data to validate
 * @returns Promise resolving to validation result
 */
const validateConsentData = async (
  consentData: Partial<IConsent>
): Promise<IConsentValidation> => {
  try {
    const response = await apiService.post<IConsentValidation>(
      API_ENDPOINTS.CONSENT.VERIFY,
      consentData,
      { requiresAuth: true }
    );
    return response.data;
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to validate consent data'],
      severity: ValidationSeverity.ERROR,
      fieldErrors: {}
    };
  }
};

/**
 * Validates permission structure and constraints
 * @param permissions - Permission settings to validate
 * @returns Promise resolving to validation result
 */
const validatePermissions = async (
  permissions: IConsentPermissions
): Promise<IConsentValidation> => {
  try {
    const response = await apiService.post<IConsentValidation>(
      `${API_ENDPOINTS.CONSENT.VERIFY}/permissions`,
      permissions,
      { requiresAuth: true }
    );
    return response.data;
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to validate permissions'],
      severity: ValidationSeverity.ERROR,
      fieldErrors: {}
    };
  }
};