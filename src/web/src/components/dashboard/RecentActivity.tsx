import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { Card } from '../common/Card';
import { IMarketplaceTransaction } from '../../interfaces/marketplace.interface';
import { formatRelativeTime } from '../../utils/date.util';

// Activity type definitions
export enum ActivityType {
  DATA_SHARED = 'data_shared',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_REVOKED = 'consent_revoked',
  PAYMENT_RECEIVED = 'payment_received',
  REQUEST_MATCHED = 'request_matched',
  BLOCKCHAIN_TRANSACTION = 'blockchain_transaction',
  SMART_CONTRACT_EXECUTION = 'smart_contract_execution'
}

// Loading state enum
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  REFRESHING = 'refreshing',
  ERROR = 'error'
}

// Activity item interface
export interface IActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  metadata: {
    transactionId?: string;
    blockchainRef?: string;
    amount?: number;
    companyName?: string;
    resourceType?: string;
  };
  accessibilityLabel: string;
  priority: number;
}

// Component props interface
export interface IRecentActivityProps {
  activities: IActivityItem[];
  maxItems?: number;
  className?: string;
  onActivityClick?: (activity: IActivityItem) => void;
  virtualizeThreshold?: number;
  loadingState: LoadingState;
  errorState?: Error;
  onRetry?: () => void;
}

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Card
    className="recent-activity__error"
    role="alert"
    ariaLabel="Error loading recent activities"
  >
    <h3>Error Loading Activities</h3>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary}>Retry</button>
  </Card>
);

// Activity item component
const ActivityItem: React.FC<{
  activity: IActivityItem;
  onClick?: (activity: IActivityItem) => void;
}> = React.memo(({ activity, onClick }) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'Space') {
      event.preventDefault();
      onClick?.(activity);
    }
  };

  const getActivityIcon = (type: ActivityType): string => {
    switch (type) {
      case ActivityType.DATA_SHARED: return '🔄';
      case ActivityType.CONSENT_GRANTED: return '✅';
      case ActivityType.CONSENT_REVOKED: return '❌';
      case ActivityType.PAYMENT_RECEIVED: return '💰';
      case ActivityType.REQUEST_MATCHED: return '🤝';
      case ActivityType.BLOCKCHAIN_TRANSACTION: return '⛓️';
      case ActivityType.SMART_CONTRACT_EXECUTION: return '📝';
      default: return '📋';
    }
  };

  return (
    <div
      className="recent-activity__item"
      role="listitem"
      tabIndex={0}
      onClick={() => onClick?.(activity)}
      onKeyDown={handleKeyDown}
      aria-label={activity.accessibilityLabel}
    >
      <span className="recent-activity__icon" aria-hidden="true">
        {getActivityIcon(activity.type)}
      </span>
      <div className="recent-activity__content">
        <h4 className="recent-activity__title">{activity.title}</h4>
        <p className="recent-activity__description">{activity.description}</p>
        {activity.metadata.blockchainRef && (
          <span className="recent-activity__blockchain-ref" title="Blockchain Reference">
            #{activity.metadata.blockchainRef.substring(0, 8)}
          </span>
        )}
        <time
          className="recent-activity__time"
          dateTime={activity.timestamp.toISOString()}
        >
          {formatRelativeTime(activity.timestamp)}
        </time>
      </div>
    </div>
  );
});

ActivityItem.displayName = 'ActivityItem';

// Main component
export const RecentActivity: React.FC<IRecentActivityProps> = React.memo(({
  activities,
  maxItems = 10,
  className,
  onActivityClick,
  virtualizeThreshold = 20,
  loadingState,
  errorState,
  onRetry
}) => {
  // Sort activities by timestamp and priority
  const sortedActivities = React.useMemo(() => {
    return [...activities]
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, maxItems);
  }, [activities, maxItems]);

  // Virtual list setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedActivities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });

  // Loading states
  const renderLoadingState = () => (
    <div className="recent-activity__loading" role="status">
      <span className="sr-only">Loading recent activities...</span>
      <div className="recent-activity__loading-spinner" aria-hidden="true" />
    </div>
  );

  // Empty state
  const renderEmptyState = () => (
    <div className="recent-activity__empty" role="status">
      <p>No recent activities to display</p>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={onRetry}
    >
      <Card
        className={classNames('recent-activity', className)}
        role="region"
        ariaLabel="Recent Activities"
      >
        <h3 className="recent-activity__header">Recent Activity</h3>
        
        {loadingState === LoadingState.LOADING && renderLoadingState()}
        
        {loadingState === LoadingState.IDLE && sortedActivities.length === 0 && renderEmptyState()}
        
        {loadingState === LoadingState.IDLE && sortedActivities.length > 0 && (
          <div
            ref={parentRef}
            className="recent-activity__list"
            role="list"
            style={{
              height: `${Math.min(sortedActivities.length * 80, 400)}px`,
              overflow: 'auto'
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={sortedActivities[virtualRow.index].id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <ActivityItem
                    activity={sortedActivities[virtualRow.index]}
                    onClick={onActivityClick}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingState === LoadingState.ERROR && errorState && (
          <div className="recent-activity__error" role="alert">
            <p>Error: {errorState.message}</p>
            {onRetry && (
              <button onClick={onRetry} className="recent-activity__retry-btn">
                Retry
              </button>
            )}
          </div>
        )}
      </Card>
    </ErrorBoundary>
  );
});

RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;