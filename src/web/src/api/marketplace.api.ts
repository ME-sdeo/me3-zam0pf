/**
 * Marketplace API Client Module
 * Implements secure, HIPAA-compliant communication with the MyElixir marketplace backend
 * @version 1.0.0
 */

import apiService from '../services/api.service';
import { IDataRequest, IDataMatch, isValidDataRequest } from '../interfaces/marketplace.interface';
import { API_ENDPOINTS } from '../constants/api.constants';
import { UUID } from 'crypto';

/**
 * Creates a new HIPAA-compliant data request in the marketplace
 * @param request - Data request details conforming to HIPAA standards
 * @returns Promise resolving to the created request
 */
export const createDataRequest = async (request: IDataRequest): Promise<IDataRequest> => {
  try {
    if (!isValidDataRequest(request)) {
      throw new Error('Invalid data request format');
    }

    const response = await apiService.post<IDataRequest>(
      API_ENDPOINTS.MARKETPLACE.REQUESTS,
      request,
      {
        requiresAuth: true,
        headers: {
          'X-Request-Source': 'marketplace',
          'X-Data-Sensitivity': 'high'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating data request:', error);
    throw error;
  }
};

/**
 * Updates an existing data request with security validation
 * @param requestId - UUID of the request to update
 * @param updates - Partial request data to update
 * @returns Promise resolving to the updated request
 */
export const updateDataRequest = async (
  requestId: UUID,
  updates: Partial<IDataRequest>
): Promise<IDataRequest> => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await apiService.put<IDataRequest>(
      `${API_ENDPOINTS.MARKETPLACE.REQUESTS}/${requestId}`,
      updates,
      {
        requiresAuth: true,
        skipCache: true
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating data request:', error);
    throw error;
  }
};

/**
 * Retrieves a specific data request by ID with caching
 * @param requestId - UUID of the request to retrieve
 * @returns Promise resolving to the request details
 */
export const getDataRequest = async (requestId: UUID): Promise<IDataRequest> => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await apiService.get<IDataRequest>(
      `${API_ENDPOINTS.MARKETPLACE.REQUESTS}/${requestId}`,
      {
        requiresAuth: true,
        headers: {
          'Cache-Control': 'max-age=300' // 5 minute cache
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error retrieving data request:', error);
    throw error;
  }
};

/**
 * Lists all data requests with filtering and pagination
 * @param filters - Optional filter criteria
 * @returns Promise resolving to array of requests
 */
export const listDataRequests = async (filters?: {
  status?: string;
  companyId?: UUID;
  page?: number;
  limit?: number;
}): Promise<IDataRequest[]> => {
  try {
    const response = await apiService.get<IDataRequest[]>(
      API_ENDPOINTS.MARKETPLACE.REQUESTS,
      {
        requiresAuth: true,
        params: filters,
        headers: {
          'Cache-Control': 'max-age=60' // 1 minute cache
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error listing data requests:', error);
    throw error;
  }
};

/**
 * Securely deletes a data request with compliance checks
 * @param requestId - UUID of the request to delete
 */
export const deleteDataRequest = async (requestId: UUID): Promise<void> => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    await apiService.delete(
      `${API_ENDPOINTS.MARKETPLACE.REQUESTS}/${requestId}`,
      {
        requiresAuth: true,
        skipCache: true
      }
    );
  } catch (error) {
    console.error('Error deleting data request:', error);
    throw error;
  }
};

/**
 * Retrieves matches for a data request with scoring
 * @param requestId - UUID of the request to get matches for
 * @returns Promise resolving to array of matches
 */
export const getMatches = async (requestId: UUID): Promise<IDataMatch[]> => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    const response = await apiService.get<IDataMatch[]>(
      `${API_ENDPOINTS.MARKETPLACE.MATCHES}/${requestId}`,
      {
        requiresAuth: true,
        headers: {
          'Cache-Control': 'max-age=60' // 1 minute cache
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error retrieving matches:', error);
    throw error;
  }
};

/**
 * Calculates pricing for data requests with market analysis
 * @param filterCriteria - Criteria for data matching
 * @returns Promise resolving to price calculation
 */
export const calculatePrice = async (filterCriteria: {
  resourceTypes: string[];
  demographics: any;
  conditions: string[];
  dateRange: { startDate: Date; endDate: Date };
}): Promise<{ estimatedMatches: number; totalPrice: number }> => {
  try {
    const response = await apiService.post(
      API_ENDPOINTS.MARKETPLACE.PRICING,
      { filterCriteria },
      {
        requiresAuth: true,
        skipCache: true
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error calculating price:', error);
    throw error;
  }
};