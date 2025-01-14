import { io, Socket } from 'socket.io-client'; // ^4.6.0
import retry from 'retry'; // ^0.13.0
import sanitizeHtml from 'sanitize-html'; // ^2.7.0
import { v4 as uuidv4 } from 'uuid';
import axiosInstance from '../utils/api.util';
import { apiConfig } from '../config/api.config';
import { API_ENDPOINTS, HTTP_HEADERS } from '../constants/api.constants';

/**
 * Interface for notification priority levels
 */
export enum NotificationPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * Interface for notification filtering options
 */
export interface NotificationFilter {
  types?: string[];
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
  read?: boolean;
}

/**
 * Interface for sanitized notification data
 */
export interface SanitizedNotification {
  id: string;
  type: string;
  message: string;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

/**
 * Interface for paginated notification response
 */
export interface NotificationResponse {
  notifications: SanitizedNotification[];
  total: number;
  page: number;
  limit: number;
  correlationId: string;
}

/**
 * Configuration for HTML sanitization to ensure HIPAA compliance
 */
const sanitizeConfig = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a'],
  allowedAttributes: {
    'a': ['href', 'target']
  },
  allowedSchemes: ['http', 'https'],
  disallowedTagsMode: 'recursiveEscape'
};

/**
 * Sanitizes notification data for HIPAA compliance
 */
const sanitizeNotification = (notification: any): SanitizedNotification => {
  return {
    id: notification.id,
    type: sanitizeHtml(notification.type, sanitizeConfig),
    message: sanitizeHtml(notification.message, sanitizeConfig),
    priority: notification.priority,
    timestamp: new Date(notification.timestamp),
    read: notification.read,
    metadata: notification.metadata ? JSON.parse(JSON.stringify(notification.metadata)) : undefined
  };
};

/**
 * Retrieves paginated list of notifications with enhanced security and filtering
 */
export const getNotifications = async (
  page: number = 1,
  limit: number = 20,
  filter?: NotificationFilter
): Promise<NotificationResponse> => {
  const correlationId = uuidv4();
  
  try {
    const response = await axiosInstance.get(API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS, {
      params: {
        page,
        limit,
        ...filter
      },
      headers: {
        [HTTP_HEADERS.X_CORRELATION_ID]: correlationId
      }
    });

    return {
      notifications: response.data.notifications.map(sanitizeNotification),
      total: response.data.total,
      page: response.data.page,
      limit: response.data.limit,
      correlationId
    };
  } catch (error) {
    console.error('Failed to fetch notifications:', { correlationId, error });
    throw error;
  }
};

/**
 * Marks a notification as read
 */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const correlationId = uuidv4();
  
  try {
    await axiosInstance.put(
      `${API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS}/${notificationId}/read`,
      null,
      {
        headers: {
          [HTTP_HEADERS.X_CORRELATION_ID]: correlationId
        }
      }
    );
  } catch (error) {
    console.error('Failed to mark notification as read:', { correlationId, error });
    throw error;
  }
};

/**
 * Establishes secure WebSocket connection with token authentication and retry logic
 */
export const subscribeToNotifications = (userId: string, authToken: string): Socket => {
  const operation = retry.operation({
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        const socket = io(apiConfig.wsURL, {
          auth: {
            token: authToken
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5
        });

        socket.on('connect', () => {
          socket.emit('subscribe', { userId });
          console.log('WebSocket connection established');
        });

        socket.on('notification', (data: any) => {
          const sanitizedNotification = sanitizeNotification(data);
          socket.emit('notification:received', { id: sanitizedNotification.id });
        });

        socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        });

        socket.on('disconnect', (reason) => {
          console.warn('WebSocket disconnected:', reason);
          if (reason === 'io server disconnect') {
            socket.connect();
          }
        });

        // Implement heartbeat to detect connection issues
        const heartbeat = setInterval(() => {
          socket.emit('ping');
        }, 30000);

        socket.on('close', () => {
          clearInterval(heartbeat);
        });

        resolve(socket);
      } catch (error) {
        if (operation.retry(error)) {
          return;
        }
        reject(error);
      }
    });
  });
};

/**
 * Deletes a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  const correlationId = uuidv4();
  
  try {
    await axiosInstance.delete(
      `${API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS}/${notificationId}`,
      {
        headers: {
          [HTTP_HEADERS.X_CORRELATION_ID]: correlationId
        }
      }
    );
  } catch (error) {
    console.error('Failed to delete notification:', { correlationId, error });
    throw error;
  }
};

/**
 * Updates notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: Record<string, boolean>
): Promise<void> => {
  const correlationId = uuidv4();
  
  try {
    await axiosInstance.put(
      `${API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS}/preferences`,
      preferences,
      {
        headers: {
          [HTTP_HEADERS.X_CORRELATION_ID]: correlationId
        }
      }
    );
  } catch (error) {
    console.error('Failed to update notification preferences:', { correlationId, error });
    throw error;
  }
};