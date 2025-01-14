import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ConsumerDashboard from '../../src/pages/consumer/ConsumerDashboard';
import { useAuth } from '../../src/hooks/useAuth';
import { useMarketplace } from '../../src/hooks/useMarketplace';
import { BlockchainVerification } from '@myelixir/blockchain-verification';
import { HIPAACompliance } from '@myelixir/hipaa-compliance';

// Mock dependencies
jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/hooks/useMarketplace');
jest.mock('@myelixir/blockchain-verification');
jest.mock('@myelixir/hipaa-compliance');
jest.mock('react-use-websocket');

// Test data constants
const MOCK_USER = {
  id: '123',
  email: 'test@example.com',
  role: 'CONSUMER'
};

const MOCK_METRICS = {
  activeRequests: 5,
  dataShared: 10,
  totalCompensation: 500.50,
  requestMatches: 3,
  blockchainVerified: true,
  lastVerifiedAt: new Date(),
  hipaaCompliant: true
};

const MOCK_MATCHES = [
  {
    id: '1',
    companyName: 'TestCorp',
    resourceType: 'Patient',
    pricePerRecord: 50,
    blockchainRef: '0x123abc',
    createdAt: new Date().toISOString(),
    score: 0.85
  }
];

describe('ConsumerDashboard', () => {
  let mockStore;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock auth hook
    (useAuth as jest.Mock).mockReturnValue({
      user: MOCK_USER,
      isAuthenticated: true
    });

    // Mock marketplace hook
    (useMarketplace as jest.Mock).mockReturnValue({
      requests: [],
      matches: MOCK_MATCHES,
      loading: false,
      error: null,
      blockchainStatus: { connected: true, lastSync: new Date() },
      complianceStatus: { hipaaCompliant: true, lastValidation: new Date() }
    });

    // Configure mock store
    mockStore = configureStore({
      reducer: {
        auth: () => ({ user: MOCK_USER }),
        marketplace: () => ({ matches: MOCK_MATCHES })
      }
    });
  });

  it('should render dashboard with all required components', async () => {
    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    // Verify core components are rendered
    expect(screen.getByRole('region', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/active requests/i)).toBeInTheDocument();
    expect(screen.getByText(/data shared/i)).toBeInTheDocument();
    expect(screen.getByText(/total compensation/i)).toBeInTheDocument();
    expect(screen.getByText(/request matches/i)).toBeInTheDocument();
  });

  it('should verify HIPAA compliance for displayed data', async () => {
    const mockHipaaCompliance = new HIPAACompliance();
    const verifyComplianceSpy = jest.spyOn(mockHipaaCompliance, 'verifyCompliance');

    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    await waitFor(() => {
      expect(verifyComplianceSpy).toHaveBeenCalled();
      expect(screen.getByTestId('hipaa-compliance-status')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('HIPAA Compliant')
      );
    });
  });

  it('should validate blockchain transactions for displayed matches', async () => {
    const mockBlockchainVerification = new BlockchainVerification();
    const verifyTransactionsSpy = jest.spyOn(mockBlockchainVerification, 'verifyTransactions');

    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    await waitFor(() => {
      expect(verifyTransactionsSpy).toHaveBeenCalledWith(
        expect.arrayContaining([MOCK_MATCHES[0].blockchainRef])
      );
    });
  });

  it('should handle real-time updates via WebSocket', async () => {
    const { rerender } = render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    // Simulate WebSocket message
    const updatedMetrics = { ...MOCK_METRICS, dataShared: 15 };
    const mockWebSocketMessage = {
      data: JSON.stringify({
        type: 'METRICS_UPDATE',
        payload: updatedMetrics
      })
    };

    // Trigger WebSocket message
    window.dispatchEvent(new MessageEvent('message', mockWebSocketMessage));

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('should meet accessibility standards', async () => {
    const { container } = render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle error states gracefully', async () => {
    // Mock error state
    (useMarketplace as jest.Mock).mockReturnValue({
      loading: false,
      error: new Error('Failed to load dashboard data'),
      matches: []
    });

    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
  });

  it('should update metrics when time range changes', async () => {
    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i });
    fireEvent.change(timeRangeSelect, { target: { value: 'month' } });

    await waitFor(() => {
      expect(useMarketplace().loadRequests).toHaveBeenCalledWith(
        expect.objectContaining({ timeRange: 'month' })
      );
    });
  });

  it('should maintain security context during user interactions', async () => {
    render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    // Click on a match item
    const matchItem = screen.getByText(MOCK_MATCHES[0].companyName);
    fireEvent.click(matchItem);

    await waitFor(() => {
      // Verify blockchain verification is maintained
      expect(screen.getByTestId('blockchain-verification')).toHaveAttribute(
        'data-verified',
        'true'
      );
      // Verify HIPAA compliance is maintained
      expect(screen.getByTestId('hipaa-compliance-status')).toHaveAttribute(
        'data-compliant',
        'true'
      );
    });
  });

  it('should properly clean up resources on unmount', () => {
    const { unmount } = render(
      <Provider store={mockStore}>
        <ConsumerDashboard />
      </Provider>
    );

    unmount();

    // Verify WebSocket connection is closed
    expect(window.WebSocket.prototype.close).toHaveBeenCalled();
  });
});