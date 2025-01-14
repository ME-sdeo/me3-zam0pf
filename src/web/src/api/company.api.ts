/**
 * Company API Client Module
 * Implements HIPAA-compliant API methods for company operations in MyElixir marketplace
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // axios ^1.3.0
import { retry } from 'axios-retry'; // axios-retry ^3.4.0
import { validate } from 'class-validator'; // class-validator ^0.14.0

import apiService from '../services/api.service';
import { ICompany, ICompanyProfile, CompanyStatus, VerificationStatus } from '../interfaces/company.interface';

/**
 * Error messages for company operations
 */
const COMPANY_ERRORS = {
  REGISTRATION_FAILED: 'Company registration failed. Please verify your information.',
  UPDATE_FAILED: 'Failed to update company profile.',
  VERIFICATION_FAILED: 'Company verification process failed.',
  INVALID_DATA: 'Invalid company data provided.',
  NOT_FOUND: 'Company not found.',
} as const;

/**
 * Registers a new healthcare company in the marketplace
 * Implements HIPAA-compliant validation and security measures
 * @param companyData - Partial company data for registration
 */
export const registerCompany = async (
  companyData: Partial<ICompany>
): Promise<AxiosResponse<ICompany>> => {
  try {
    // Validate required fields
    const validationErrors = await validate(companyData);
    if (validationErrors.length > 0) {
      throw new Error(COMPANY_ERRORS.INVALID_DATA);
    }

    // Set initial status values
    const initialCompanyData = {
      ...companyData,
      status: CompanyStatus.PENDING_REVIEW,
      verificationStatus: VerificationStatus.UNVERIFIED,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Make secure API request with retry logic
    const response = await apiService.post<ICompany>(
      '/companies/register',
      initialCompanyData,
      {
        requiresAuth: true,
        headers: {
          'X-Request-Source': 'company-registration',
          'X-Company-Type': companyData.type
        }
      }
    );

    return response;
  } catch (error) {
    console.error('Company registration error:', error);
    throw new Error(COMPANY_ERRORS.REGISTRATION_FAILED);
  }
};

/**
 * Updates company profile information with security validation
 * @param companyId - Unique identifier of the company
 * @param profileData - Updated profile information
 */
export const updateCompanyProfile = async (
  companyId: string,
  profileData: Partial<ICompanyProfile>
): Promise<AxiosResponse<ICompany>> => {
  try {
    // Validate profile data
    const validationErrors = await validate(profileData);
    if (validationErrors.length > 0) {
      throw new Error(COMPANY_ERRORS.INVALID_DATA);
    }

    // Make secure API request
    const response = await apiService.put<ICompany>(
      `/companies/${companyId}/profile`,
      {
        ...profileData,
        updatedAt: new Date()
      },
      {
        requiresAuth: true,
        headers: {
          'X-Request-Source': 'profile-update',
          'X-Company-ID': companyId
        }
      }
    );

    return response;
  } catch (error) {
    console.error('Company profile update error:', error);
    throw new Error(COMPANY_ERRORS.UPDATE_FAILED);
  }
};

/**
 * Retrieves company information with security checks
 * @param companyId - Unique identifier of the company
 */
export const getCompanyDetails = async (
  companyId: string
): Promise<AxiosResponse<ICompany>> => {
  try {
    const response = await apiService.get<ICompany>(
      `/companies/${companyId}`,
      {
        requiresAuth: true,
        headers: {
          'X-Request-Source': 'company-details',
          'X-Company-ID': companyId
        }
      }
    );

    return response;
  } catch (error) {
    console.error('Company details retrieval error:', error);
    throw new Error(COMPANY_ERRORS.NOT_FOUND);
  }
};

/**
 * Initiates or updates company verification process
 * @param companyId - Unique identifier of the company
 * @param verificationData - Verification documents and information
 */
export const verifyCompany = async (
  companyId: string,
  verificationData: {
    documents: File[];
    certifications: string[];
    additionalInfo?: Record<string, unknown>;
  }
): Promise<AxiosResponse<ICompany>> => {
  try {
    const formData = new FormData();
    verificationData.documents.forEach((doc, index) => {
      formData.append(`document_${index}`, doc);
    });
    formData.append('certifications', JSON.stringify(verificationData.certifications));
    if (verificationData.additionalInfo) {
      formData.append('additionalInfo', JSON.stringify(verificationData.additionalInfo));
    }

    const response = await apiService.post<ICompany>(
      `/companies/${companyId}/verify`,
      formData,
      {
        requiresAuth: true,
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Request-Source': 'company-verification',
          'X-Company-ID': companyId
        }
      }
    );

    return response;
  } catch (error) {
    console.error('Company verification error:', error);
    throw new Error(COMPANY_ERRORS.VERIFICATION_FAILED);
  }
};

/**
 * Updates company status with security validation
 * @param companyId - Unique identifier of the company
 * @param status - New company status
 */
export const updateCompanyStatus = async (
  companyId: string,
  status: CompanyStatus
): Promise<AxiosResponse<ICompany>> => {
  try {
    const response = await apiService.put<ICompany>(
      `/companies/${companyId}/status`,
      { status },
      {
        requiresAuth: true,
        headers: {
          'X-Request-Source': 'status-update',
          'X-Company-ID': companyId
        }
      }
    );

    return response;
  } catch (error) {
    console.error('Company status update error:', error);
    throw new Error(COMPANY_ERRORS.UPDATE_FAILED);
  }
};