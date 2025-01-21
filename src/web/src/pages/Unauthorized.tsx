import React from 'react'; // ^18.0.0
import { useNavigate } from 'react-router-dom'; // ^6.8.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useBlockchainState } from '@myelixir/blockchain'; // ^1.0.0
import { useConsentVerification } from '@myelixir/consent'; // ^1.0.0

import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';

import styles from '../styles/pages/_unauthorized.scss';

const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="error-boundary">
    <h2>Error Displaying Unauthorized Page</h2>
    <pre>{error.message}</pre>
  </div>
);

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { verifyBlockchainState, clearBlockchainState } = useBlockchainState();
  const { verifyConsent, clearConsentData } = useConsentVerification();

  // Detect user preferences for accessibility
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMedicalEnvironment = process.env.REACT_APP_MEDICAL_ENVIRONMENT === 'true';

  const handleBackToHome = React.useCallback(async () => {
    try {
      // Security: Verify blockchain state before navigation
      await verifyBlockchainState();
      
      // Security: Verify any pending consent requirements
      await verifyConsent();
      
      // Clear sensitive session data
      clearBlockchainState();
      clearConsentData();
      
      // Log security event
      console.info('[Security] User redirected from unauthorized page');
      
      // Navigate to home
      navigate('/');
    } catch (error) {
      console.error('[Security] Navigation blocked due to verification failure:', error);
    }
  }, [navigate, verifyBlockchainState, verifyConsent, clearBlockchainState, clearConsentData]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('[Security] Error in Unauthorized component:', error);
      }}
    >
      <main 
        className={`
          ${styles.unauthorized}
          ${prefersHighContrast ? styles.unauthorizedHighContrast : ''}
          ${prefersReducedMotion ? styles.unauthorizedReducedMotion : ''}
        `}
        role="main"
        aria-labelledby="unauthorized-title"
      >
        <PageHeader
          title="Access Denied"
          subtitle="You don't have permission to access this resource"
          medicalEnvironment={isMedicalEnvironment}
        />

        <div className={styles.unauthorizedContent}>
          <div 
            className={styles.unauthorizedMessage}
            role="alert"
            aria-live="polite"
          >
            <p>
              This action requires additional permissions or consent verification.
              Please contact your administrator or verify your consent settings.
            </p>
            <p>
              If you believe this is an error, please ensure all required
              consents are properly configured in your account settings.
            </p>
          </div>

          <div className={styles.unauthorizedActions}>
            <Button
              variant="primary"
              onClick={handleBackToHome}
              ariaLabel="Return to home page"
              medicalEnvironment={isMedicalEnvironment}
              requiresConsent={false}
              confirmationRequired={false}
            >
              Return to Home
            </Button>
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default Unauthorized;