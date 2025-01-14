import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, describe, it, jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material';
import Button from '../../../src/components/common/Button';

// Mock theme for testing
const theme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#2196F3',
    },
    secondary: {
      main: '#FFC107',
    },
  },
};

// Helper function to render button with theme context
const renderButton = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <Button {...props} />
    </ThemeProvider>
  );
};

describe('Button Component - Healthcare Context', () => {
  describe('Visual Hierarchy & Material Design', () => {
    it('renders primary variant with correct styles', () => {
      const { container } = renderButton({
        variant: 'primary',
        children: 'Primary Action',
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--primary');
      expect(button).toHaveStyle({
        backgroundColor: '#2196F3',
        minHeight: undefined,
      });
    });

    it('renders critical medical action variant', () => {
      const { container } = renderButton({
        variant: 'critical',
        children: 'Emergency Action',
        medicalEnvironment: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--critical');
      expect(button).toHaveStyle({
        minHeight: '48px',
        minWidth: '48px',
      });
    });

    it('applies medical environment optimizations', () => {
      const { container } = renderButton({
        children: 'Medical Action',
        medicalEnvironment: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--medical-environment');
      expect(button).toHaveAttribute('data-medical-environment', 'true');
    });
  });

  describe('Accessibility Compliance', () => {
    it('provides proper ARIA attributes', () => {
      const { container } = renderButton({
        children: 'Accessible Button',
        ariaLabel: 'Test Button',
        disabled: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveAttribute('aria-label', 'Test Button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('handles loading state with ARIA updates', () => {
      const { container } = renderButton({
        children: 'Loading Button',
        loading: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-live', 'polite');
    });

    it('maintains focus visibility', () => {
      const { container } = renderButton({
        children: 'Focusable Button',
      });
      
      const button = container.firstChild as HTMLElement;
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Consent Management', () => {
    it('displays consent required indicator', () => {
      const { container } = renderButton({
        children: 'Consent Required',
        requiresConsent: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--consent-required');
      expect(button).toHaveAttribute('data-requires-consent', 'true');
      expect(button.querySelector('.button__consent-indicator')).toBeInTheDocument();
    });

    it('handles consent-required variant', () => {
      const { container } = renderButton({
        children: 'Consent Action',
        variant: 'consent-required',
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--consent-required');
    });
  });

  describe('Transaction States', () => {
    it('displays transaction pending state', () => {
      const { container } = renderButton({
        children: 'Processing',
        transactionPending: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveAttribute('data-transaction-pending', 'true');
      expect(button.querySelector('.button__transaction-indicator')).toBeInTheDocument();
    });

    it('disables interaction during transaction', () => {
      const handleClick = jest.fn();
      const { container } = renderButton({
        children: 'Transaction',
        transactionPending: true,
        onClick: handleClick,
      });
      
      const button = container.firstChild as HTMLElement;
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Medical Action Confirmation', () => {
    it('requires confirmation for critical actions', async () => {
      const handleClick = jest.fn();
      window.confirm = jest.fn(() => true);
      
      const { container } = renderButton({
        children: 'Critical Action',
        confirmationRequired: true,
        onClick: handleClick,
      });
      
      const button = container.firstChild as HTMLElement;
      fireEvent.click(button);
      
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to proceed with this action?'
      );
      expect(handleClick).toHaveBeenCalled();
    });

    it('cancels action when confirmation declined', () => {
      const handleClick = jest.fn();
      window.confirm = jest.fn(() => false);
      
      const { container } = renderButton({
        children: 'Cancelable Action',
        confirmationRequired: true,
        onClick: handleClick,
      });
      
      const button = container.firstChild as HTMLElement;
      fireEvent.click(button);
      
      expect(window.confirm).toHaveBeenCalled();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Theme Support', () => {
    it('adapts to light theme', () => {
      const { container } = renderButton({
        children: 'Light Theme Button',
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveStyle({
        backgroundColor: '#2196F3',
      });
    });

    it('supports full width layout', () => {
      const { container } = renderButton({
        children: 'Full Width',
        fullWidth: true,
      });
      
      const button = container.firstChild as HTMLElement;
      expect(button).toHaveClass('button--full-width');
    });
  });
});