import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import Card from '../common/Card';

// Constants for theme-aware colors and animations
const TREND_COLORS = {
  positive: '#4CAF50',
  negative: '#F44336',
  neutral: '#9E9E9E',
} as const;

const ANIMATION_DURATION = '300ms';

export interface IMetricsCardProps {
  /** Title of the metric */
  title: string;
  /** Current value of the metric */
  value: number | string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Optional trend percentage */
  trend?: number;
  /** Optional trend description for screen readers */
  trendLabel?: string;
  /** Optional CSS class for custom styling */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Custom ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Formats trend value with proper sign and percentage
 * @param trend - Trend value to format
 * @returns Formatted trend string
 */
const formatTrend = (trend: number): string => {
  if (isNaN(trend)) return '0%';
  const sign = trend > 0 ? '+' : '';
  return `${sign}${trend.toFixed(1)}%`;
};

/**
 * A Material Design card component that displays key metrics with trend indicators
 * and enhanced accessibility features.
 */
export const MetricsCard = React.memo<IMetricsCardProps>(({
  title,
  value,
  icon,
  trend,
  trendLabel,
  className,
  onClick,
  ariaLabel,
}) => {
  // Determine trend color based on value
  const getTrendColor = (trendValue?: number): string => {
    if (!trendValue) return TREND_COLORS.neutral;
    return trendValue > 0 ? TREND_COLORS.positive : TREND_COLORS.negative;
  };

  // Format numeric values with proper localization
  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(val);
    }
    return val;
  };

  const cardClasses = classNames(
    'metrics-card',
    {
      'metrics-card--interactive': !!onClick,
    },
    className
  );

  const trendClasses = classNames(
    'metrics-card__trend',
    {
      'metrics-card__trend--positive': trend && trend > 0,
      'metrics-card__trend--negative': trend && trend < 0,
    }
  );

  // Comprehensive ARIA label for screen readers
  const metricsAriaLabel = ariaLabel || `${title}: ${formatValue(value)}${
    trend ? `, ${trendLabel || `Trend ${formatTrend(trend)}`}` : ''
  }`;

  return (
    <Card
      className={cardClasses}
      interactive={!!onClick}
      onClick={onClick}
      ariaLabel={metricsAriaLabel}
      role="region"
    >
      <div className="metrics-card__content">
        {icon && (
          <div className="metrics-card__icon" aria-hidden="true">
            {icon}
          </div>
        )}
        
        <div className="metrics-card__main">
          <h3 className="metrics-card__title">{title}</h3>
          
          <div className="metrics-card__value-container">
            <span className="metrics-card__value">
              {formatValue(value)}
            </span>
            
            {trend !== undefined && (
              <span 
                className={trendClasses}
                style={{ 
                  color: getTrendColor(trend),
                  transition: `color ${ANIMATION_DURATION} ease-out`
                }}
                aria-label={trendLabel || `Trend ${formatTrend(trend)}`}
              >
                {formatTrend(trend)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;