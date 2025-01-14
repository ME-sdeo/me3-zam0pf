import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import '../../styles/components/_card.scss';

export interface ICardProps {
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the card */
  className?: string;
  /** Whether the card should have interactive hover/focus states */
  interactive?: boolean;
  /** Whether the card should have elevated appearance */
  elevated?: boolean;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** ARIA role for accessibility */
  role?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
  /** Keyboard event handler */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** Whether the card is in a loading state */
  loading?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
}

/**
 * A flexible Material Design card component that provides a container for content
 * with proper elevation, interactive states, and accessibility features.
 */
export const Card = React.memo<ICardProps>(({
  children,
  className,
  interactive = false,
  elevated = false,
  onClick,
  role = 'region',
  ariaLabel,
  tabIndex,
  onKeyDown,
  loading = false,
  disabled = false,
}) => {
  // Handle keyboard interaction for interactive cards
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!interactive || disabled) return;
    
    if (event.key === 'Enter' || event.key === 'Space') {
      event.preventDefault();
      onClick?.();
    }

    onKeyDown?.(event);
  };

  // Compute CSS classes
  const cardClasses = classNames(
    'card',
    {
      'card--interactive': interactive && !disabled,
      'card--elevated': elevated,
      'card--loading': loading,
    },
    className
  );

  // Compute interactive props
  const interactiveProps = interactive && !disabled ? {
    onClick,
    onKeyDown: handleKeyDown,
    role: role || 'button',
    tabIndex: tabIndex ?? 0,
  } : {
    role,
  };

  // Compute accessibility attributes
  const accessibilityProps = {
    'aria-label': ariaLabel,
    'aria-disabled': disabled,
    'aria-busy': loading,
  };

  return (
    <div
      className={cardClasses}
      {...interactiveProps}
      {...accessibilityProps}
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;