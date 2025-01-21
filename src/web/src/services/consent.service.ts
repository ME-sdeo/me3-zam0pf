/**
 * @fileoverview Consent Service Implementation
 * Implements secure, HIPAA-compliant consent operations with blockchain verification
 * @version 1.0.0
 */

import dayjs from 'dayjs'; // ^1.11.0
import { 
  IConsent, 
  IConsentPermissions, 
  ConsentStatus, 
  ValidationSeverity,
  EncryptionLevel,
  IConsentValidation
} from '../interfaces/consent.interface';
import { validateFHIRResource } from '../utils/validation.util';
import { 
  grantConsent, 
  revokeConsent, 
  updateConsentPermissions, 
  getUserConsents 
} from '../api/consent.api';
import { Resource } from '@medplum/fhirtypes';

/**
 * Service class implementing secure consent management operations
 * with blockchain verification and HIPAA compliance
 */
export class ConsentService {
  /**
   * Creates a new consent record with enhanced validation and blockchain verification
   * @param consentData - Consent data including permissions and constraints
   * @returns Created consent record with blockchain reference
   */
  public async createConsent(consentData: Omit<IConsent, 'id' | 'blockchainRef'>): Promise<IConsent> {
    try {
      // Validate consent data structure and permissions
      const validationResult = await this.validateConsentData(consentData);
      if (!validationResult.isValid) {
        throw new Error(`Consent validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Validate FHIR resource types in permissions
      for (const resourceType of consentData.permissions.resourceTypes) {
        const fhirValidation = await validateFHIRResource({ resourceType } as Resource);
        if (!fhirValidation.valid) {
          throw new Error(`Invalid FHIR resource type: ${resourceType}`);
        }
      }

      // Set default encryption level if not provided
      const enhancedData = {
        ...consentData,
        permissions: {
          ...consentData.permissions,
          encryptionLevel: consentData.permissions.encryptionLevel || EncryptionLevel.FIELD_LEVEL
        }
      };

      // Set default validity period if not provided
      if (!enhancedData.validTo) {
        enhancedData.validTo = dayjs().add(1, 'year').toDate();
      }

      // Create consent with blockchain verification
      const createdConsent = await grantConsent(enhancedData);

      return createdConsent;
    } catch (error) {
      console.error('Error creating consent:', error);
      throw error;
    }
  }

  /**
   * Revokes an existing consent record with blockchain verification
   * @param consentId - UUID of consent to revoke
   */
  public async removeConsent(consentId: string): Promise<void> {
    try {
      // Validate consent ID format
      if (!consentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(consentId)) {
        throw new Error('Invalid consent ID format');
      }

      // Revoke consent with blockchain verification
      await revokeConsent(consentId);
    } catch (error) {
      console.error('Error removing consent:', error);
      throw error;
    }
  }

  /**
   * Updates permissions for an existing consent record with security validation
   * @param consentId - UUID of consent to update
   * @param permissions - New permission settings
   * @returns Updated consent record with new blockchain verification
   */
  public async updateConsent(consentId: string, permissions: IConsentPermissions): Promise<IConsent> {
    try {
      // Validate consent ID and permissions
      if (!this.validateConsentId(consentId)) {
        throw new Error('Invalid consent ID format');
      }

      // Validate updated permissions
      const validationResult = await this.validateConsentData({ permissions } as IConsent);
      if (!validationResult.isValid) {
        throw new Error(`Invalid permissions: ${validationResult.errors.join(', ')}`);
      }

      // Update consent with blockchain verification
      const updatedConsent = await updateConsentPermissions(consentId, permissions);

      return updatedConsent;
    } catch (error) {
      console.error('Error updating consent:', error);
      throw error;
    }
  }

  /**
   * Retrieves all consent records for the current user with status verification
   * @returns List of user's consent records with status
   */
  public async getConsents(): Promise<IConsent[]> {
    try {
      // Retrieve consents with blockchain verification
      const consents = await getUserConsents();

      // Filter and validate consents
      const validConsents = consents.filter(consent => {
        // Verify consent hasn't expired
        const isExpired = dayjs(consent.validTo).isBefore(dayjs());
        if (isExpired) {
          return false;
        }

        // Verify consent status is active
        return consent.status === ConsentStatus.ACTIVE;
      });

      return validConsents;
    } catch (error) {
      console.error('Error retrieving consents:', error);
      throw error;
    }
  }

  /**
   * Validates consent data structure and permissions
   * @param consentData - Consent data to validate
   * @returns Validation result with security context
   */
  private async validateConsentData(consentData: Partial<IConsent>): Promise<IConsentValidation> {
    try {
      // Check required fields
      if (!consentData.permissions) {
        return {
          isValid: false,
          errors: ['Missing required permissions'],
          severity: ValidationSeverity.ERROR,
          fieldErrors: {}
        };
      }

      // Validate permissions structure
      const { permissions } = consentData;
      if (!permissions.resourceTypes?.length || !permissions.accessLevel || !permissions.purpose) {
        return {
          isValid: false,
          errors: ['Missing required permission fields'],
          severity: ValidationSeverity.ERROR,
          fieldErrors: {}
        };
      }

      // Validate time-based access restrictions
      if (permissions.constraints?.timeRestrictions) {
        for (const restriction of permissions.constraints.timeRestrictions) {
          if (!restriction.startTime || !restriction.endTime || dayjs(restriction.endTime).isBefore(dayjs(restriction.startTime))) {
            return {
              isValid: false,
              errors: ['Invalid time restrictions'],
              severity: ValidationSeverity.ERROR,
              fieldErrors: {}
            };
          }
        }
      }

      return {
        isValid: true,
        errors: [],
        severity: ValidationSeverity.INFO,
        fieldErrors: {}
      };
    } catch (error) {
      console.error('Error validating consent data:', error);
      return {
        isValid: false,
        errors: ['Validation error occurred'],
        severity: ValidationSeverity.ERROR,
        fieldErrors: {}
      };
    }
  }

  /**
   * Validates consent ID format
   * @param consentId - Consent ID to validate
   * @returns boolean indicating if ID is valid
   */
  private validateConsentId(consentId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(consentId);
  }
}

// Export singleton instance
export default new ConsentService();