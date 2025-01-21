import React, { useEffect, useState, useCallback } from 'react';
import { Grid } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import useWebSocket from 'react-use-websocket';

import ActivityChart from '../../components/dashboard/ActivityChart';
import CompensationChart from '../../components/dashboard/CompensationChart';
import MetricsCard from '../../components/dashboard/MetricsCard';
import RecentActivity from '../../components/dashboard/RecentActivity';
import { useAuth } from '../../hooks/useAuth';
import { useMarketplace } from '../../hooks/useMarketplace';
import { BlockchainVerification } from '@myelixir/blockchain-verification';
import { HIPAACompliance } from '@myelixir/hipaa-compliance';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { ActivityType, LoadingState } from '../../components/dashboard/RecentActivity';

// Dashboard metrics interface with blockchain verification
interface IDashboardMetrics {
  activeRequests: number;
  dataShared: number;
  totalCompensation: number;
  requestMatches: number;
  blockchainVerified: boolean;
  lastVerifiedAt: Date;
  hipaaCompliant: boolean;
}

// Time range options for data filtering
const TIME_RANGES = [
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'year', label: 'Last 12 Months' }
] as const;

// WebSocket event types
const WEBSOCKET_EVENTS = {
  METRICS_UPDATE: 'METRICS_UPDATE',
  BLOCKCHAIN_VERIFICATION: 'BLOCKCHAIN_VERIFICATION',
  ACTIVITY_UPDATE: 'ACTIVITY_UPDATE'
} as const;

const ConsumerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { requests, matches } = useMarketplace();
  const [metrics, setMetrics] = useState<IDashboardMetrics | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<typeof TIME_RANGES[number]['value']>('week');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.LOADING);

  // Initialize WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    retryOnError: true
  });

  // Initialize blockchain verification
  const blockchainVerification = new BlockchainVerification();
  const hipaaCompliance = new HIPAACompliance();

  // Fetch dashboard metrics with blockchain verification
  const fetchDashboardMetrics = useCallback(async (timeRange: string) => {
    try {
      setLoadingState(LoadingState.LOADING);

      // Filter requests and matches based on time range
      const filteredRequests = requests.filter(request => {
        const requestDate = new Date(request.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - requestDate.getTime()) / (1000 * 3600 * 24);
        
        switch (timeRange) {
          case 'day': return diffDays <= 1;
          case 'week': return diffDays <= 7;
          case 'month': return diffDays <= 30;
          case 'year': return diffDays <= 365;
          default: return true;
        }
      });

      // Calculate metrics
      const metrics: IDashboardMetrics = {
        activeRequests: filteredRequests.length,
        dataShared: matches.length,
        totalCompensation: matches.reduce((sum, match) => sum + (match.amount?.value || 0), 0),
        requestMatches: matches.filter(match => match.score >= 0.7).length,
        blockchainVerified: false,
        lastVerifiedAt: new Date(),
        hipaaCompliant: true
      };

      // Verify blockchain transactions
      const blockchainVerified = await blockchainVerification.verifyTransactions(
        matches.map(match => match.blockchainRef || '')
      );
      metrics.blockchainVerified = blockchainVerified;

      // Verify HIPAA compliance
      const complianceVerified = await hipaaCompliance.verifyCompliance(
        matches.map(match => match.resourceId)
      );
      metrics.hipaaCompliant = complianceVerified;

      setMetrics(metrics);
      setLoadingState(LoadingState.IDLE);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      setLoadingState(LoadingState.ERROR);
    }
  }, [requests, matches]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      
      switch (data.type) {
        case WEBSOCKET_EVENTS.METRICS_UPDATE:
          setMetrics(prevMetrics => ({ ...prevMetrics, ...data.payload }));
          break;
        case WEBSOCKET_EVENTS.BLOCKCHAIN_VERIFICATION:
          setMetrics(prevMetrics => ({
            ...prevMetrics!,
            blockchainVerified: data.payload.verified,
            lastVerifiedAt: new Date(data.payload.timestamp)
          }));
          break;
      }
    }
  }, [lastMessage]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardMetrics(selectedTimeRange);
  }, [fetchDashboardMetrics, selectedTimeRange]);

  // Error boundary fallback
  const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div role="alert" className="dashboard-error">
      <h2>Dashboard Error</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="consumer-dashboard">
        <Grid container spacing={3}>
          {/* Metrics Cards */}
          <Grid item xs={12} md={3}>
            <MetricsCard
              title="Active Requests"
              value={metrics?.activeRequests || 0}
              icon="📊"
              ariaLabel="Number of active data requests"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricsCard
              title="Data Shared"
              value={metrics?.dataShared || 0}
              icon="🔄"
              ariaLabel="Number of data records shared"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricsCard
              title="Total Compensation"
              value={`$${metrics?.totalCompensation.toFixed(2) || '0.00'}`}
              icon="💰"
              ariaLabel="Total compensation received"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricsCard
              title="Request Matches"
              value={metrics?.requestMatches || 0}
              icon="🤝"
              ariaLabel="Number of matched requests"
            />
          </Grid>

          {/* Activity Chart */}
          <Grid item xs={12} md={8}>
            <ActivityChart
              timeRange={selectedTimeRange}
              height={400}
              showLegend
              showTooltip
            />
          </Grid>

          {/* Compensation Chart */}
          <Grid item xs={12} md={4}>
            <CompensationChart
              height={400}
              showBlockchainVerification
              complianceConfig={{
                hipaaCompliant: metrics?.hipaaCompliant || false,
                auditLevel: 'FULL',
                retentionPeriod: '7_YEARS'
              }}
              userId={user?.id || ''}
            />
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <RecentActivity
              activities={matches.map(match => ({
                id: match.id,
                type: ActivityType.DATA_SHARED,
                title: `Data shared with ${match.metadata?.companyName || 'Unknown Company'}`,
                description: `Matched request for ${match.metadata?.resourceType || 'Unknown'} data`,
                timestamp: new Date(match.createdAt),
                metadata: {
                  blockchainRef: match.blockchainRef,
                  amount: match.amount?.value
                },
                accessibilityLabel: `Data shared with ${match.metadata?.companyName || 'Unknown Company'} at ${new Date(match.createdAt).toLocaleString()}`,
                priority: 1
              }))}
              loadingState={loadingState}
              maxItems={10}
              virtualizeThreshold={20}
            />
          </Grid>
        </Grid>
      </div>
    </ErrorBoundary>
  );
};

export default ConsumerDashboard;