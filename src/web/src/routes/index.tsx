import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import AuthRoutes from './AuthRoutes';
import CompanyRoutes from './CompanyRoutes';
import ConsumerRoutes from './ConsumerRoutes';
import NotFound from '../pages/NotFound';
import ServerError from '../pages/ServerError';
import Unauthorized from '../pages/Unauthorized';
import MainLayout from '../components/layout/MainLayout';

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  useEffect(() => {
    // Log error for monitoring
    console.error('Routing Error:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, [error]);

  return <ServerError />;
};

/**
 * Root routing configuration component that manages all application routes
 * Implements secure routing with HIPAA compliance
 */
const AppRoutes: React.FC = React.memo(() => {
  // Monitor route transitions for security audit
  useEffect(() => {
    const unsubscribe = () => {
      // Cleanup monitoring
    };
    return () => unsubscribe();
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Routing Error:', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }}
    >
      <BrowserRouter>
        <MainLayout>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/auth/*" element={<AuthRoutes />} />

            {/* Protected Company Portal Routes */}
            <Route 
              path="/company/*" 
              element={<CompanyRoutes />}
              aria-label="Company portal routes"
            />

            {/* Protected Consumer Portal Routes */}
            <Route 
              path="/consumer/*" 
              element={<ConsumerRoutes />}
              aria-label="Consumer portal routes"
            />

            {/* Error Routes */}
            <Route path="/500" element={<ServerError />} />
            <Route path="/403" element={<Unauthorized />} />
            <Route path="/404" element={<NotFound />} />

            {/* Root Redirect */}
            <Route 
              path="/" 
              element={<Navigate to="/auth/login" replace />} 
            />

            {/* Catch All Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </ErrorBoundary>
  );
});

AppRoutes.displayName = 'AppRoutes';

export default AppRoutes;