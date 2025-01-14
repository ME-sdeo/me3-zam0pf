import { useState, useEffect, useCallback } from 'react'; // react ^18.0.0
import { Logger } from '@azure/logger'; // @azure/logger ^1.0.0
import { BlockchainClient } from '@hyperledger/fabric-gateway'; // @hyperledger/fabric-gateway ^1.1.0
import { io } from 'socket.io-client'; // socket.io-client ^4.0.0

import { IDataRequest, IDataMatch } from '../interfaces/marketplace.interface';
import marketplaceService from '../services/marketplace.service';
import { RequestStatus, MatchStatus } from '../types/marketplace.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Constants for marketplace operations
const MIN_MATCH_SCORE = 0.7;
const MIN_PRICE_PER_RECORD = 0.1;
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_DURATION_MS = 300000; // 5 minutes
const WEBSOCKET_RECONNECT_MS = 5000;

/**
 * Custom hook for managing HIPAA-compliant marketplace operations
 * Implements secure data exchange with blockchain tracking
 */
export const useMarketplace = (initialFilters?: Partial<IDataRequest['filterCriteria']>) => {
  // State management
  const [requests, setRequests] = useState<IDataRequest[]>([]);
  const [matches, setMatches] = useState<IDataMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState({
    connected: false,
    lastSync: null as Date | null
  });
  const [complianceStatus, setComplianceStatus] = useState({
    hipaaCompliant: true,
    lastValidation: new Date(),
    validationErrors: [] as string[]
  });

  // Initialize logger and blockchain client
  const logger = new Logger('MarketplaceHook');
  const blockchainClient = new BlockchainClient();

  /**
   * Creates a new HIPAA-compliant data request
   */
  const createRequest = useCallback(async (request: IDataRequest): Promise<IDataRequest> => {
    setLoading(true);
    try {
      // Validate HIPAA compliance
      const validationResult = await marketplaceService.validateHIPAACompliance(request);
      if (!validationResult.isValid) {
        setComplianceStatus(prev => ({
          ...prev,
          hipaaCompliant: false,
          validationErrors: validationResult.errors
        }));
        throw new Error('Request does not meet HIPAA compliance requirements');
      }

      // Create request with blockchain tracking
      const createdRequest = await marketplaceService.createRequest(request);
      
      setRequests(prev => [...prev, createdRequest]);
      
      // Update compliance status
      setComplianceStatus(prev => ({
        ...prev,
        hipaaCompliant: true,
        lastValidation: new Date()
      }));

      return createdRequest;
    } catch (err) {
      const error = err as Error;
      logger.error('Error creating request:', error);
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads active marketplace requests with caching
   */
  const loadRequests = useCallback(async (filters?: Partial<IDataRequest['filterCriteria']>) => {
    setLoading(true);
    try {
      const activeRequests = await marketplaceService.loadActiveRequests(filters);
      setRequests(activeRequests);

      // Update blockchain status
      setBlockchainStatus(prev => ({
        ...prev,
        lastSync: new Date()
      }));
    } catch (err) {
      const error = err as Error;
      logger.error('Error loading requests:', error);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Finds matches for a data request with scoring
   */
  const findMatches = useCallback(async (requestId: string): Promise<IDataMatch[]> => {
    setLoading(true);
    try {
      const matches = await marketplaceService.findMatches(requestId);
      
      // Filter matches based on minimum score
      const validMatches = matches.filter(match => match.score >= MIN_MATCH_SCORE);
      
      setMatches(validMatches);
      return validMatches;
    } catch (err) {
      const error = err as Error;
      logger.error('Error finding matches:', error);
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calculates pricing for data request
   */
  const calculatePrice = useCallback(async (
    filterCriteria: IDataRequest['filterCriteria']
  ): Promise<{ estimatedMatches: number; totalPrice: number }> => {
    try {
      const pricing = await marketplaceService.calculatePrice(filterCriteria);
      
      if (pricing.totalPrice / pricing.estimatedMatches < MIN_PRICE_PER_RECORD) {
        throw new Error('Price per record below minimum threshold');
      }

      return pricing;
    } catch (err) {
      const error = err as Error;
      logger.error('Error calculating price:', error);
      setError(error);
      throw error;
    }
  }, []);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const socket = io(API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS, {
      reconnectionDelay: WEBSOCKET_RECONNECT_MS,
      reconnectionAttempts: MAX_RETRY_ATTEMPTS
    });

    socket.on('connect', () => {
      logger.info('WebSocket connected for marketplace updates');
    });

    socket.on('requestUpdate', (updatedRequest: IDataRequest) => {
      setRequests(prev => 
        prev.map(req => req.id === updatedRequest.id ? updatedRequest : req)
      );
    });

    socket.on('matchUpdate', (updatedMatch: IDataMatch) => {
      setMatches(prev => 
        prev.map(match => match.id === updatedMatch.id ? updatedMatch : match)
      );
    });

    socket.on('error', (err: Error) => {
      logger.error('WebSocket error:', err);
      setError(err);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Load initial requests
  useEffect(() => {
    loadRequests(initialFilters);
  }, [initialFilters, loadRequests]);

  return {
    // State
    requests,
    matches,
    loading,
    error,
    blockchainStatus,
    complianceStatus,

    // Actions
    createRequest,
    loadRequests,
    findMatches,
    calculatePrice
  };
};

export default useMarketplace;