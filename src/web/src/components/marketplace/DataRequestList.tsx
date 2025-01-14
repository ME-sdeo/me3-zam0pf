import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Chip, 
  Tooltip, 
  Alert,
  useTheme 
} from '@mui/material';
import { debounce } from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Table from '../common/Table';
import { IDataRequest } from '../../interfaces/marketplace.interface';
import { MarketplaceService } from '../../services/marketplace.service';
import { RequestStatus } from '../../types/marketplace.types';

// Component Props Interface
interface DataRequestListProps {
  filters?: {
    status?: RequestStatus[];
    companyId?: string;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  };
  onRequestSelect?: (request: IDataRequest) => void;
  onStatusChange?: (requestId: string, status: RequestStatus) => void;
  pageSize?: number;
  enableRealtime?: boolean;
}

// Cache interface for optimizing data fetching
interface RequestCache {
  data: IDataRequest[];
  timestamp: number;
  filters: string;
}

const CACHE_DURATION = 60000; // 1 minute cache
const DEFAULT_PAGE_SIZE = 10;

export const DataRequestList: React.FC<DataRequestListProps> = ({
  filters,
  onRequestSelect,
  onStatusChange,
  pageSize = DEFAULT_PAGE_SIZE,
  enableRealtime = true
}) => {
  const theme = useTheme();
  const [requests, setRequests] = useState<IDataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<RequestCache | null>(null);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      field: 'title',
      header: 'Request Title',
      sortable: true,
      render: (value: string, row: IDataRequest) => (
        <Tooltip title={row.description} arrow>
          <Typography
            variant="body2"
            sx={{
              cursor: 'pointer',
              '&:hover': { color: theme.palette.primary.main }
            }}
          >
            {value}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'filterCriteria',
      header: 'Criteria',
      render: (value: IDataRequest['filterCriteria']) => (
        <Box>
          {value.resourceTypes.map((type) => (
            <Chip
              key={type}
              label={type}
              size="small"
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          ))}
        </Box>
      )
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      render: (value: RequestStatus) => (
        <Chip
          label={value}
          color={getStatusColor(value)}
          size="small"
          onClick={onStatusChange ? () => handleStatusChange(value) : undefined}
        />
      )
    },
    {
      field: 'pricePerRecord',
      header: 'Price/Record',
      sortable: true,
      render: (value: number) => (
        <Typography variant="body2">
          ${value.toFixed(2)}
        </Typography>
      )
    }
  ], [theme, onStatusChange]);

  // Fetch requests with caching
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filterKey = JSON.stringify(filters);

      // Check cache validity
      if (cache && 
          cache.filters === filterKey && 
          Date.now() - cache.timestamp < CACHE_DURATION) {
        setRequests(cache.data);
        setLoading(false);
        return;
      }

      const response = await MarketplaceService.listRequests({
        ...filters,
        page: 1,
        limit: pageSize
      });

      const newCache: RequestCache = {
        data: response,
        timestamp: Date.now(),
        filters: filterKey
      };

      setCache(newCache);
      setRequests(response);
    } catch (err) {
      setError('Failed to load data requests. Please try again.');
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize, cache]);

  // Handle real-time updates
  const handleRealTimeUpdate = useCallback((updatedRequest: IDataRequest) => {
    setRequests(prevRequests => {
      const index = prevRequests.findIndex(r => r.id === updatedRequest.id);
      if (index === -1) return [...prevRequests, updatedRequest];
      
      const newRequests = [...prevRequests];
      newRequests[index] = updatedRequest;
      return newRequests;
    });
  }, []);

  // Setup real-time subscription
  useEffect(() => {
    let subscription: any;

    if (enableRealtime) {
      subscription = MarketplaceService.subscribeToUpdates(handleRealTimeUpdate);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [enableRealtime, handleRealTimeUpdate]);

  // Initial data fetch
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Debounced status change handler
  const handleStatusChange = debounce(async (status: RequestStatus) => {
    if (!onStatusChange) return;
    
    try {
      await onStatusChange(status, RequestStatus.ACTIVE);
      await fetchRequests();
    } catch (err) {
      setError('Failed to update request status. Please try again.');
      console.error('Error updating status:', err);
    }
  }, 300);

  // Status color mapping utility
  const getStatusColor = (status: RequestStatus): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case RequestStatus.ACTIVE:
        return 'success';
      case RequestStatus.MATCHING:
        return 'primary';
      case RequestStatus.COMPLETED:
        return 'secondary';
      case RequestStatus.EXPIRED:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          An error occurred while displaying the data requests.
        </Alert>
      }
    >
      <Box sx={{ width: '100%' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Table
          columns={columns}
          data={requests}
          loading={loading}
          pagination
          pageSize={pageSize}
          virtualScroll={requests.length > 100}
          onSort={(field, direction) => {
            // Handle sorting
          }}
          onRowSelect={onRequestSelect}
        />
      </Box>
    </ErrorBoundary>
  );
};

export default DataRequestList;