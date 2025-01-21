import React, { useMemo, useEffect, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid,
  TooltipProps
} from 'recharts';
import { format } from 'date-fns';
import { ErrorBoundary } from 'react-error-boundary';

import { useMarketplace } from '../../hooks/useMarketplace';
import Card from '../common/Card';

// Chart configuration constants
const DEFAULT_CHART_HEIGHT = 300;
const REFRESH_INTERVAL = 30000; // 30 seconds
const CHART_COLORS = {
  dataShared: '#2196F3',
  requestMatches: '#4CAF50',
  transactions: '#FFC107'
} as const;

const ACCESSIBILITY_LABELS = {
  chart: 'Activity trends over time',
  tooltip: 'Activity details for selected date',
  legend: 'Chart activity types'
} as const;

interface ActivityChartProps {
  timeRange: 'day' | 'week' | 'month' | 'year';
  className?: string;
  height?: number;
  refreshInterval?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  accessibilityLabel?: string;
}

interface ChartDataPoint {
  timestamp: Date;
  dataShared: number;
  requestMatches: number;
  transactions: number;
  uniqueUsers: number;
  totalValue: number;
}

const ActivityChart: React.FC<ActivityChartProps> = React.memo(({
  timeRange = 'day',
  className,
  height = DEFAULT_CHART_HEIGHT,
  refreshInterval = REFRESH_INTERVAL,
  showLegend = true,
  showTooltip = true,
  accessibilityLabel = ACCESSIBILITY_LABELS.chart
}) => {
  const { requests, matches, loading, error } = useMarketplace();

  // Memoized data aggregation
  const aggregateActivityData = useMemo(() => {
    if (!requests || !matches) return [];

    const now = new Date();
    const timeRangeMap = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(now.getTime() - timeRangeMap[timeRange]);
    
    // Filter and group activities by time period
    const filteredRequests = requests.filter(r => new Date(r.createdAt) >= startTime);
    const filteredMatches = matches.filter(m => new Date(m.createdAt) >= startTime);

    // Create time buckets based on range
    const buckets: Map<string, ChartDataPoint> = new Map();
    const formatString = timeRange === 'day' ? 'HH:mm' : 'MM/dd';

    // Aggregate data into buckets
    [...filteredRequests, ...filteredMatches].forEach(activity => {
      const timestamp = new Date(activity.createdAt);
      const key = format(timestamp, formatString);

      if (!buckets.has(key)) {
        buckets.set(key, {
          timestamp,
          dataShared: 0,
          requestMatches: 0,
          transactions: 0,
          uniqueUsers: 0,
          totalValue: 0
        });
      }

      const bucket = buckets.get(key)!;
      if ('resourceId' in activity) {
        bucket.dataShared++;
      } else if ('score' in activity) {
        bucket.requestMatches++;
      }
      
      if ('pricePerRecord' in activity) {
        bucket.transactions++;
        bucket.totalValue += activity.pricePerRecord;
      }
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [requests, matches, timeRange]);

  // Auto-refresh data
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Marketplace hook handles the refresh internally
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Custom tooltip formatter
  const formatTooltip = useCallback((props: TooltipProps<number, string>) => {
    const { active, payload, label } = props;
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="activity-chart__tooltip" role="tooltip" aria-label={ACCESSIBILITY_LABELS.tooltip}>
        <p className="activity-chart__tooltip-label">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="activity-chart__tooltip-value">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }, []);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div role="alert" className="activity-chart__error">
      <p>Error loading activity chart: {error.message}</p>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Card
        className={`activity-chart ${className || ''}`}
        elevated
        aria-busy={loading}
        aria-label={accessibilityLabel}
      >
        {loading ? (
          <div className="activity-chart__loading" role="status">
            Loading activity data...
          </div>
        ) : error ? (
          <div className="activity-chart__error" role="alert">
            {error.message}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart
              data={aggregateActivityData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={(point: ChartDataPoint) => format(point.timestamp, 'MM/dd HH:mm')}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              
              {showTooltip && (
                <Tooltip
                  content={formatTooltip}
                  wrapperStyle={{ outline: 'none' }}
                />
              )}
              
              {showLegend && (
                <Legend
                  verticalAlign="top"
                  height={36}
                  aria-label={ACCESSIBILITY_LABELS.legend}
                />
              )}

              <Line
                type="monotone"
                dataKey="dataShared"
                stroke={CHART_COLORS.dataShared}
                name="Data Shared"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="requestMatches"
                stroke={CHART_COLORS.requestMatches}
                name="Request Matches"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="transactions"
                stroke={CHART_COLORS.transactions}
                name="Transactions"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </ErrorBoundary>
  );
});

ActivityChart.displayName = 'ActivityChart';

export default ActivityChart;