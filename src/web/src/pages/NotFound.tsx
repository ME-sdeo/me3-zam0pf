import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import styles from './NotFound.module.scss';

/**
 * NotFound - A 404 error page component that provides a user-friendly interface
 * when users attempt to access non-existent routes.
 * Implements Material Design principles and WCAG 2.1 Level AA accessibility standards.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  /**
   * Handles navigation back to the previous page or home route
   * with proper focus management for accessibility
   */
  const handleGoBack = (): void => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <main 
      className={styles['not-found']}
      role="main"
      aria-labelledby="not-found-title"
    >
      <div className={styles['not-found__content']}>
        <PageHeader
          title="Page Not Found"
          subtitle="The page you're looking for doesn't exist or has been moved."
          role="banner"
        />

        <section 
          className={styles['not-found__message']}
          aria-live="polite"
        >
          <p>
            We couldn't find the page you were looking for. This might be because:
          </p>
          <ul>
            <li>The page has been moved or deleted</li>
            <li>The URL was typed incorrectly</li>
            <li>You don't have permission to view this page</li>
          </ul>
        </section>

        <div 
          className={styles['not-found__actions']}
          role="group"
          aria-label="Navigation options"
        >
          <Button
            variant="primary"
            onClick={handleGoBack}
            aria-label="Go back to previous page"
            medicalEnvironment={true}
          >
            Go Back
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/', { replace: true })}
            aria-label="Return to home page"
            medicalEnvironment={true}
          >
            Go to Home
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;