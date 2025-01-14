import React, { useEffect } from 'react';
import IconButton from '@mui/material/IconButton'; // v5.0.0
import CloseIcon from '@mui/icons-material/Close'; // v5.0.0
import '../../styles/components/_alert.scss';

interface AlertProps {
  severity: 'success' | 'warning' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
  autoHideDuration?: number;
}

const useAutoHide = (duration?: number, onClose?: () => void) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [duration, onClose]);
};

const Alert: React.FC<AlertProps> = ({
  severity,
  message,
  onClose,
  className = '',
  autoHideDuration
}) => {
  useAutoHide(autoHideDuration, onClose);

  const getAriaLabel = () => {
    const severityMap = {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
      info: 'Information'
    };
    return `${severityMap[severity]} alert: ${message}`;
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`alert alert--${severity} ${className}`}
      role="alert"
      aria-live="polite"
      aria-label={getAriaLabel()}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="alert__icon">
        {severity === 'success' && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4C12.76,4 13.5,4.11 14.2,4.31L15.77,2.74C14.61,2.26 13.34,2 12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12M7.91,10.08L6.5,11.5L11,16L21,6L19.59,4.58L11,13.17L7.91,10.08Z" />
          </svg>
        )}
        {severity === 'warning' && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z" />
          </svg>
        )}
        {severity === 'error' && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
          </svg>
        )}
        {severity === 'info' && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
          </svg>
        )}
      </div>
      <div className="alert__message">{message}</div>
      {onClose && (
        <IconButton
          className="alert__close"
          onClick={onClose}
          aria-label="Close alert"
          size="small"
          edge="end"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </div>
  );
};

export default Alert;