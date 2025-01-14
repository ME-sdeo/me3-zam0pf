import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { SecurityMonitor } from '@azure/security-monitor';
import { BlockchainStateProvider } from '@hyperledger/fabric-client';

import AuthRoutes from './AuthRoutes';
import CompanyRoutes from './CompanyRoutes';
import ConsumerRoutes from './ConsumerRoutes';
import NotFound from '../pages/NotFound';
import ServerError from '../pages/ServerError';
import Unauthorized from '../pages/Unauthorized';
import MainLayout from '../components/layout/MainLayout';

// Initialize security monitoring
const securityMonitor = new SecurityMonitor({
  enableAuditLogging: true,
  hipaaCompliant: true,
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000 // 1 minute
  }
});

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  useEffect(() => {
    securityMonitor.trackError('ROUTING_ERROR', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, [error]);

  return <ServerError />;
};

/**
 * Root routing configuration component that manages all application routes
 * Implements secure routing with HIPAA compliance and blockchain verification
 */
const AppRoutes: React.FC = React.memo(() => {
  // Monitor route transitions for security audit
  useEffect(() => {
    const unsubscribe = securityMonitor.startRouteMonitoring();
    return () => unsubscribe();
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        securityMonitor.trackError('ROUTING_ERROR', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }}
    >
      <BlockchainStateProvider>
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
      </BlockchainStateProvider>
    </ErrorBoundary>
  );
});

AppRoutes.displayName = 'AppRoutes';

export default AppRoutes;