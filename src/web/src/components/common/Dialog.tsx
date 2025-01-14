import React, { useEffect, useCallback } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { createPortal } from 'react-dom'; // ^18.0.0
import {
  'dialog-overlay': dialogOverlay,
  dialog,
  'dialog-content': dialogContent,
  'dialog-header': dialogHeader,
  'dialog-body': dialogBody,
  'dialog-footer': dialogFooter,
  'dialog-high-contrast': dialogHighContrast
} from '../../styles/components/_dialog.scss';
import Button from './Button';

interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  requiresConsent?: boolean;
  transactionState?: 'idle' | 'pending' | 'complete' | 'error';
  securityLevel?: 'low' | 'medium' | 'high';
}

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  actions?: DialogAction[];
  closeOnOverlayClick?: boolean;
  className?: string;
  testId?: string;
  securityLevel?: 'low' | 'medium' | 'high';
  consentRequired?: boolean;
  transactionPending?: boolean;
  highContrast?: boolean;
}

const verifyConsent = async (actionId: string): Promise<boolean> => {
  // Verify user consent for sensitive operations
  if (!actionId) return false;
  
  try {
    // Simulated consent verification - replace with actual implementation
    return await new Promise(resolve => setTimeout(() => resolve(true), 100));
  } catch (error) {
    console.error('Consent verification failed:', error);
    return false;
  }
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  actions = [],
  closeOnOverlayClick = true,
  className,
  testId = 'dialog',
  securityLevel = 'low',
  consentRequired = false,
  transactionPending = false,
  highContrast = false,
}) => {
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (closeOnOverlayClick && !transactionPending) {
      onClose();
    }
  }, [closeOnOverlayClick, transactionPending, onClose]);

  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !transactionPending) {
      onClose();
    }
  }, [transactionPending, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscapeKey]);

  if (!isOpen) return null;

  const dialogClasses = classNames(
    dialog,
    `dialog--${size}`,
    {
      'dialog--high-security': securityLevel === 'high',
      'dialog--consent-required': consentRequired,
      'dialog--transaction-pending': transactionPending,
      [dialogHighContrast]: highContrast,
    },
    className
  );

  const content = (
    <>
      <div 
        className={dialogOverlay} 
        onClick={handleOverlayClick}
        data-testid={`${testId}-overlay`}
      />
      <div
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        data-testid={testId}
        data-security-level={securityLevel}
        data-consent-required={consentRequired}
        data-transaction-pending={transactionPending}
      >
        <div className={dialogHeader}>
          <h2 id={`${testId}-title`}>{title}</h2>
        </div>
        <div className={dialogContent}>
          <div className={dialogBody}>
            {children}
          </div>
          {actions.length > 0 && (
            <div className={dialogFooter}>
              {actions.map((action, index) => (
                <Button
                  key={`${action.label}-${index}`}
                  variant={action.variant || 'primary'}
                  onClick={async () => {
                    if (action.requiresConsent) {
                      const hasConsent = await verifyConsent(action.label);
                      if (!hasConsent) return;
                    }
                    action.onClick();
                  }}
                  disabled={
                    action.disabled || 
                    transactionPending || 
                    (action.transactionState === 'pending')
                  }
                  requiresConsent={action.requiresConsent}
                  transactionPending={action.transactionState === 'pending'}
                  medicalEnvironment={true}
                  confirmationRequired={securityLevel === 'high'}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default Dialog;