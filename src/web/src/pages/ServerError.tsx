import React, { useEffect, useState } from 'react'; // ^18.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import Button from '../../components/common/Button';
import PageHeader from '../../components/common/PageHeader';

import styles from './ServerError.module.scss';

const ServerError: React.FC = () => {
  const navigate = useNavigate();
  const [isHighContrastMode, setIsHighContrastMode] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isMedicalDevice, setIsMedicalDevice] = useState(false);

  useEffect(() => {
    // Detect system preferences for medical environment optimizations
    const mediaQueryList = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrastMode(mediaQueryList.matches);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(motionQuery.matches);

    // Basic medical device detection based on user agent and screen properties
    const isMedicalDisplay = window.screen.width === 1280 && window.screen.height === 1024;
    const userAgent = navigator.userAgent.toLowerCase();
    setIsMedicalDevice(isMedicalDisplay || userAgent.includes('medical'));

    // HIPAA-compliant error logging
    console.error('Server Error encountered', {
      timestamp: new Date().toISOString(),
      errorCode: '500',
      environment: process.env.NODE_ENV,
      userAgent: navigator.userAgent,
      // Exclude PHI from logs
      sessionId: crypto.randomUUID()
    });
  }, []);

  const handleReturnHome = () => {
    // Clear any PHI from error states
    sessionStorage.removeItem('lastError');
    localStorage.removeItem('errorContext');

    // Reset blockchain transaction states
    sessionStorage.removeItem('pendingTransactions');

    // Clear consent verification states
    sessionStorage.removeItem('activeConsents');

    // Navigate home
    navigate('/');
  };

  return (
    <div 
      className={`${styles['server-error']} ${
        isHighContrastMode ? styles['server-error--high-contrast'] : ''
      } ${
        isReducedMotion ? styles['server-error--reduced-motion'] : ''
      } ${
        isMedicalDevice ? styles['server-error--medical-device'] : ''
      }`}
      role="alert"
      aria-live="assertive"
    >
      <PageHeader
        title="System Error"
        subtitle="A server error has occurred"
        medicalEnvironment={isMedicalDevice}
      />

      <div className={styles['server-error__content']}>
        <p 
          className={styles['server-error__message']}
          style={{
            fontSize: isMedicalDevice ? '18px' : '16px',
            fontWeight: isHighContrastMode ? 500 : 400
          }}
        >
          We apologize for the inconvenience. A system error has occurred while processing your request.
          Your health data and privacy remain secure.
        </p>

        <p 
          className={styles['server-error__description']}
          style={{
            fontSize: isMedicalDevice ? '16px' : '14px',
            opacity: isHighContrastMode ? 1 : 0.87
          }}
        >
          This error has been logged and our team has been notified. Any in-progress health data
          transactions have been safely paused. Please return to the home page and try again.
        </p>

        <div className={styles['server-error__action']}>
          <Button
            variant="primary"
            onClick={handleReturnHome}
            medicalEnvironment={isMedicalDevice}
            ariaLabel="Return to home page"
            size="large"
            highContrast={isHighContrastMode}
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServerError;