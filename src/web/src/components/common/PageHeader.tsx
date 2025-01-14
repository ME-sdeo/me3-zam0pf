import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import Button from './Button';

import {
  'page-header': pageHeader,
  'page-header--medical': pageHeaderMedical,
  'page-header__back': pageHeaderBack,
  'page-header__content': pageHeaderContent,
  'page-header__title': pageHeaderTitle,
  'page-header__subtitle': pageHeaderSubtitle,
  'page-header__action': pageHeaderAction,
  'page-header__blockchain': pageHeaderBlockchain
} from '../../styles/components/_page-header.scss';

// Type definitions
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  consentRequired?: boolean;
  blockchainState?: 'pending' | 'confirmed' | 'failed';
}

interface BackButtonProps {
  show?: boolean;
  onClick: () => void;
  preserveConsent?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  medicalEnvironment?: boolean;
  actionButton?: ActionButtonProps;
  backButton?: BackButtonProps;
  className?: string;
}

// Helper function to generate header classes
const getHeaderClasses = (className?: string, medicalEnvironment?: boolean): string => {
  return classNames(
    pageHeader,
    {
      [pageHeaderMedical]: medicalEnvironment,
    },
    className
  );
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  medicalEnvironment = false,
  actionButton,
  backButton,
  className,
}) => {
  // Determine header classes with medical environment optimizations
  const headerClasses = getHeaderClasses(className, medicalEnvironment);

  return (
    <header 
      className={headerClasses}
      role="banner"
      aria-label={title}
      data-medical-environment={medicalEnvironment}
    >
      {/* Back button with consent preservation */}
      {backButton?.show && (
        <div className={pageHeaderBack}>
          <Button
            variant="outline"
            onClick={backButton.onClick}
            ariaLabel="Go back"
            medicalEnvironment={medicalEnvironment}
            consentRequired={backButton.preserveConsent}
          >
            <span aria-hidden="true">←</span>
            <span className="visually-hidden">Back</span>
          </Button>
        </div>
      )}

      {/* Header content with enhanced contrast for medical environments */}
      <div className={pageHeaderContent}>
        <h1 
          className={pageHeaderTitle}
          style={{
            // Enhanced contrast for medical environments
            fontWeight: medicalEnvironment ? 500 : 400,
            fontSize: medicalEnvironment ? '24px' : '20px',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p 
            className={pageHeaderSubtitle}
            style={{
              // Enhanced visibility for medical environments
              opacity: medicalEnvironment ? 0.95 : 0.87,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Action button with consent and blockchain states */}
      {actionButton && (
        <div className={pageHeaderAction}>
          <Button
            variant={actionButton.variant || 'primary'}
            onClick={actionButton.onClick}
            consentRequired={actionButton.consentRequired}
            medicalEnvironment={medicalEnvironment}
            transactionPending={actionButton.blockchainState === 'pending'}
            ariaLabel={actionButton.label}
          >
            {actionButton.label}
          </Button>

          {/* Blockchain state indicator */}
          {actionButton.blockchainState && (
            <div 
              className={pageHeaderBlockchain}
              aria-live="polite"
              role="status"
            >
              <span 
                className={`blockchain-state blockchain-state--${actionButton.blockchainState}`}
                aria-label={`Transaction ${actionButton.blockchainState}`}
              >
                {actionButton.blockchainState === 'pending' && '⏳'}
                {actionButton.blockchainState === 'confirmed' && '✓'}
                {actionButton.blockchainState === 'failed' && '⚠'}
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

// Default export
export default PageHeader;