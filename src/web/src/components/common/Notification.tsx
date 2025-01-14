import React, { useCallback, useEffect, memo } from 'react';
import { IconButton } from '@mui/material'; // ^5.0.0
import { Close } from '@mui/icons-material'; // ^5.0.0
import classNames from 'classnames'; // ^2.3.1
import { auditLog } from '@hipaa/audit-logging'; // ^1.0.0
import { useNotification } from '../../hooks/useNotification';

// Notification Types and Priority Levels
export enum NotificationType {
  DATA_REQUEST = 'DATA_REQUEST',
  CONSENT_UPDATE = 'CONSENT_UPDATE',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
  ERROR = 'ERROR',
  BLOCKCHAIN_TRANSACTION = 'BLOCKCHAIN_TRANSACTION',
  HIPAA_ALERT = 'HIPAA_ALERT'
}

export enum NotificationPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

// Props Interface
export interface NotificationProps {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  blockchainRef?: string;
  onMarkAsRead?: (id: string) => Promise<void>;
  onDismiss?: (id: string) => Promise<void>;
}

// Notification Component with HIPAA Compliance
const Notification: React.FC<NotificationProps> = memo(({
  id,
  type,
  priority,
  title,
  message,
  timestamp,
  isRead,
  blockchainRef,
  onMarkAsRead,
  onDismiss
}) => {
  const {
    markAsRead,
    removeNotification,
    verifyBlockchainTransaction
  } = useNotification();

  // Handle notification read status
  const handleMarkAsRead = useCallback(async () => {
    try {
      await markAsRead(id);
      onMarkAsRead?.(id);
      
      // HIPAA Audit Logging
      auditLog({
        action: 'NOTIFICATION_READ',
        resourceId: id,
        resourceType: type,
        status: 'SUCCESS',
        metadata: {
          notificationType: type,
          blockchainRef
        }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      auditLog({
        action: 'NOTIFICATION_READ',
        resourceId: id,
        resourceType: type,
        status: 'ERROR',
        error
      });
    }
  }, [id, type, blockchainRef, markAsRead, onMarkAsRead]);

  // Handle notification dismissal
  const handleDismiss = useCallback(async () => {
    try {
      await removeNotification(id);
      onDismiss?.(id);

      // HIPAA Audit Logging
      auditLog({
        action: 'NOTIFICATION_DISMISS',
        resourceId: id,
        resourceType: type,
        status: 'SUCCESS',
        metadata: {
          notificationType: type,
          blockchainRef
        }
      });
    } catch (error) {
      console.error('Error dismissing notification:', error);
      auditLog({
        action: 'NOTIFICATION_DISMISS',
        resourceId: id,
        resourceType: type,
        status: 'ERROR',
        error
      });
    }
  }, [id, type, blockchainRef, removeNotification, onDismiss]);

  // Verify blockchain transaction if reference exists
  useEffect(() => {
    if (blockchainRef && type === NotificationType.BLOCKCHAIN_TRANSACTION) {
      verifyBlockchainTransaction(blockchainRef).catch(error => {
        console.error('Error verifying blockchain transaction:', error);
        auditLog({
          action: 'BLOCKCHAIN_VERIFICATION',
          resourceId: blockchainRef,
          resourceType: 'TRANSACTION',
          status: 'ERROR',
          error
        });
      });
    }
  }, [blockchainRef, type, verifyBlockchainTransaction]);

  // Notification styling based on priority and type
  const notificationClasses = classNames(
    'notification',
    `notification--${priority.toLowerCase()}`,
    `notification--${type.toLowerCase()}`,
    {
      'notification--unread': !isRead,
      'notification--blockchain': !!blockchainRef
    }
  );

  // Accessibility attributes
  const ariaAttributes = {
    role: 'alert',
    'aria-live': priority === NotificationPriority.URGENT ? 'assertive' : 'polite',
    'aria-atomic': 'true',
    'aria-labelledby': `notification-${id}-title`,
    'aria-describedby': `notification-${id}-message`
  };

  return (
    <div className={notificationClasses} {...ariaAttributes}>
      <div className="notification__header">
        <h3 
          id={`notification-${id}-title`}
          className="notification__title"
        >
          {title}
        </h3>
        <div className="notification__actions">
          {!isRead && (
            <IconButton
              aria-label="Mark as read"
              onClick={handleMarkAsRead}
              size="small"
              className="notification__action-btn"
            >
              <span className="notification__read-indicator" />
            </IconButton>
          )}
          <IconButton
            aria-label="Dismiss notification"
            onClick={handleDismiss}
            size="small"
            className="notification__action-btn"
          >
            <Close />
          </IconButton>
        </div>
      </div>
      <div 
        id={`notification-${id}-message`}
        className="notification__content"
      >
        <p className="notification__message">{message}</p>
        <span className="notification__timestamp">
          {new Date(timestamp).toLocaleString()}
        </span>
        {blockchainRef && (
          <div className="notification__blockchain">
            <span className="notification__blockchain-label">
              Transaction ID:
            </span>
            <code className="notification__blockchain-ref">
              {blockchainRef}
            </code>
          </div>
        )}
      </div>
    </div>
  );
});

// Display name for debugging
Notification.displayName = 'Notification';

export default Notification;