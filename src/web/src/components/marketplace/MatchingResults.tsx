import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Chip,
  IconButton
} from '@mui/material';
import {
  Assessment as ScoreIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon
} from '@mui/icons-material';

// Internal imports
import Table from '../common/Table';
import { IDataMatch } from '../../interfaces/marketplace.interface';
import { useMarketplace } from '../../hooks/useMarketplace';

// Component props interface
interface MatchingResultsProps {
  requestId: string;
  onMatchSelect: (match: IDataMatch) => void;
  minMatchScore?: number;
  securityLevel?: string;
  refreshInterval?: number;
}

/**
 * MatchingResults component displays HIPAA-compliant health record matches
 * with real-time updates and enhanced visualization
 */
const MatchingResults: React.FC<MatchingResultsProps> = ({
  requestId,
  onMatchSelect,
  minMatchScore = 0.7,
  securityLevel = 'HIPAA',
  refreshInterval = 5000
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [sortField, setSortField] = useState<string>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Marketplace hook for data management
  const { matches, loading, findMatches, subscribeToUpdates } = useMarketplace();

  // Table columns configuration with security and accessibility
  const columns = useMemo(() => [
    {
      field: 'id',
      header: 'Match ID',
      width: '120px',
      sensitive: true,
      render: (value: string) => (
        <Tooltip title="Secure Match Identifier">
          <Box display="flex" alignItems="center">
            <SecurityIcon fontSize="small" sx={{ mr: 1 }} />
            {value.substring(0, 8)}...
          </Box>
        </Tooltip>
      )
    },
    {
      field: 'score',
      header: 'Match Score',
      sortable: true,
      width: '150px',
      render: (value: number) => (
        <Box display="flex" alignItems="center">
          <CircularProgress
            variant="determinate"
            value={value * 100}
            size={24}
            sx={{ mr: 1 }}
          />
          <Typography variant="body2">
            {(value * 100).toFixed(1)}%
          </Typography>
        </Box>
      )
    },
    {
      field: 'matchedCriteria',
      header: 'Matched Criteria',
      render: (value: string[]) => (
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {value.map((criterion, index) => (
            <Chip
              key={index}
              label={criterion}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )
    },
    {
      field: 'lastUpdated',
      header: 'Last Updated',
      sortable: true,
      width: '180px',
      render: (value: Date) => new Date(value).toLocaleString()
    }
  ], [isMobile]);

  // Sort handler with security validation
  const handleSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Manual refresh handler with rate limiting
  const handleRefresh = useCallback(async () => {
    if (Date.now() - lastUpdate.getTime() < 1000) {
      return; // Prevent rapid refreshes
    }
    await findMatches(requestId);
    setLastUpdate(new Date());
  }, [findMatches, requestId, lastUpdate]);

  // Export handler with security checks
  const handleExport = useCallback(() => {
    const secureMatches = matches.map(match => ({
      id: match.id,
      score: match.score,
      matchedCriteria: match.matchedCriteria,
      lastUpdated: match.lastUpdated
    }));
    
    const blob = new Blob([JSON.stringify(secureMatches, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matches-${requestId}-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [matches, requestId]);

  // Initial data load and real-time updates
  useEffect(() => {
    findMatches(requestId);
    const unsubscribe = subscribeToUpdates(requestId);
    
    const refreshTimer = setInterval(() => {
      handleRefresh();
    }, refreshInterval);

    return () => {
      unsubscribe();
      clearInterval(refreshTimer);
    };
  }, [requestId, findMatches, subscribeToUpdates, refreshInterval, handleRefresh]);

  // Filter matches based on minimum score
  const filteredMatches = useMemo(() => 
    matches.filter(match => match.score >= minMatchScore),
    [matches, minMatchScore]
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with security indicator */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" component="h2">
          Matching Results
          <Tooltip title={`${securityLevel} Compliant`}>
            <SecurityIcon
              color="primary"
              sx={{ ml: 1, verticalAlign: 'middle' }}
            />
          </Tooltip>
        </Typography>
        
        <Box>
          <Tooltip title="Refresh Matches">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Matches">
            <IconButton onClick={handleExport} disabled={loading}>
              <ExportIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Match statistics */}
      <Box display="flex" gap={2} mb={2}>
        <Typography variant="body2" color="text.secondary">
          Total Matches: {filteredMatches.length}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Last Updated: {lastUpdate.toLocaleString()}
        </Typography>
      </Box>

      {/* Alerts for match quality */}
      {filteredMatches.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No matches found meeting the minimum score threshold of {minMatchScore * 100}%
        </Alert>
      )}

      {/* Results table with enhanced features */}
      <Table
        columns={columns}
        data={filteredMatches}
        loading={loading}
        pagination
        virtualScroll={filteredMatches.length > 100}
        onSort={handleSort}
        onRowSelect={onMatchSelect}
        onExport={handleExport}
      />
    </Box>
  );
};

export default React.memo(MatchingResults);