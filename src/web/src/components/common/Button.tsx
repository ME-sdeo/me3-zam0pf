import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import {
  button,
  'button--primary': buttonPrimary,
  'button--secondary': buttonSecondary,
  'button--outline': buttonOutline,
  'button--critical': buttonCritical,
  'button--consent-required': buttonConsentRequired
} from '../../styles/components/_button.scss';

// Type definitions for button props
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'critical' | 'consent-required';
type ButtonType = 'button' | 'submit' | 'reset';

interface ButtonProps {
  variant?: ButtonVariant;
  type?: ButtonType;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  requiresConsent?: boolean;
  transactionPending?: boolean;
  medicalEnvironment?: boolean;
  confirmationRequired?: boolean;
}

const getButtonClasses = (props: ButtonProps): string => {
  const {
    variant = 'primary',
    fullWidth,
    disabled,
    loading,
    transactionPending,
    requiresConsent,
    medicalEnvironment,
    className
  } = props;

  return classNames(
    button,
    {
      [buttonPrimary]: variant === 'primary',
      [buttonSecondary]: variant === 'secondary',
      [buttonOutline]: variant === 'outline',
      [buttonCritical]: variant === 'critical',
      [buttonConsentRequired]: variant === 'consent-required' || requiresConsent,
      'button--full-width': fullWidth,
      'button--disabled': disabled,
      'button--loading': loading,
      'button--transaction-pending': transactionPending,
      'button--medical-environment': medicalEnvironment,
    },
    className
  );
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  children,
  className,
  ariaLabel,
  requiresConsent = false,
  transactionPending = false,
  medicalEnvironment = false,
  confirmationRequired = false,
}) => {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (confirmationRequired) {
      const confirmed = window.confirm('Are you sure you want to proceed with this action?');
      if (!confirmed) {
        return;
      }
    }
    onClick?.(event);
  };

  const buttonClasses = getButtonClasses({
    variant,
    fullWidth,
    disabled,
    loading,
    transactionPending,
    requiresConsent,
    medicalEnvironment,
    className,
  });

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading || transactionPending}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={disabled}
      aria-live={loading ? 'polite' : undefined}
      data-requires-consent={requiresConsent}
      data-transaction-pending={transactionPending}
      data-medical-environment={medicalEnvironment}
      style={{
        // Enhanced touch target size for medical environments
        minHeight: medicalEnvironment ? '48px' : undefined,
        minWidth: medicalEnvironment ? '48px' : undefined,
      }}
    >
      {loading && (
        <span className="button__loading-indicator" aria-hidden="true">
          {/* Loading spinner rendered via CSS */}
        </span>
      )}
      
      {transactionPending && (
        <span className="button__transaction-indicator" aria-hidden="true">
          {/* Transaction pending indicator rendered via CSS */}
        </span>
      )}
      
      {requiresConsent && (
        <span className="button__consent-indicator" aria-hidden="true">
          {/* Consent required indicator rendered via CSS */}
        </span>
      )}
      
      <span className={loading ? 'button__content button__content--loading' : 'button__content'}>
        {children}
      </span>
    </button>
  );
};

export default Button;