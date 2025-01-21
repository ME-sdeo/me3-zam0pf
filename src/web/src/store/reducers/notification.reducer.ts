import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { NotificationActionTypes } from '../actions/notification.actions';

// Types for notification state management
interface Notification {
  id: string;
  type: 'REQUEST' | 'CONSENT' | 'PAYMENT' | 'SYSTEM';
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  read: boolean;
}

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  expiresAt?: Date;
}

interface NotificationPreferences {
  REQUEST: boolean;
  CONSENT: boolean;
  PAYMENT: boolean;
  SYSTEM: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
}

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  preferences: NotificationPreferences;
  totalCount: number;
  unreadCount: number;
  currentPage: number;
  websocketConnected: boolean;
  websocketError: string | null;
  lastSync: Date | null;
  cache: { [key: string]: Notification };
  systemAlerts: SystemAlert[];
}

// Initial state with default values
const initialState: NotificationState = {
  notifications: [],
  loading: false,
  error: null,
  preferences: {
    REQUEST: true,
    CONSENT: true,
    PAYMENT: true,
    SYSTEM: true,
    emailEnabled: true,
    pushEnabled: true,
    soundEnabled: true
  },
  totalCount: 0,
  unreadCount: 0,
  currentPage: 1,
  websocketConnected: false,
  websocketError: null,
  lastSync: null,
  cache: {},
  systemAlerts: []
};

// Create the notification reducer with comprehensive state management
export const notificationReducer = createReducer(initialState, (builder) => {
  builder
    // Fetch notifications handlers
    .addCase(NotificationActionTypes.FETCH_NOTIFICATIONS_START, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(NotificationActionTypes.FETCH_NOTIFICATIONS_SUCCESS, (state, action) => {
      state.loading = false;
      state.notifications = action.payload.page === 1 
        ? action.payload.notifications 
        : [...state.notifications, ...action.payload.notifications];
      state.totalCount = action.payload.total;
      state.currentPage = action.payload.page;
      state.lastSync = new Date();
      
      // Update cache with new notifications
      action.payload.notifications.forEach(notification => {
        state.cache[notification.id] = notification;
      });

      // Calculate unread count
      state.unreadCount = state.notifications.filter(n => !n.read).length;
    })
    .addCase(NotificationActionTypes.FETCH_NOTIFICATIONS_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    })

    // WebSocket connection handlers
    .addCase(NotificationActionTypes.WEBSOCKET_CONNECTED, (state) => {
      state.websocketConnected = true;
      state.websocketError = null;
    })
    .addCase(NotificationActionTypes.WEBSOCKET_DISCONNECTED, (state) => {
      state.websocketConnected = false;
    })
    .addCase(NotificationActionTypes.WEBSOCKET_ERROR, (state, action) => {
      state.websocketConnected = false;
      state.websocketError = action.payload.message;
    })

    // WebSocket message handler
    .addCase(NotificationActionTypes.WEBSOCKET_MESSAGE, (state, action) => {
      const notification = action.payload;
      
      // Add to cache
      state.cache[notification.id] = notification;
      
      // Add to notifications list if matches preferences
      if (state.preferences[notification.type]) {
        state.notifications.unshift(notification);
        state.totalCount += 1;
        if (!notification.read) {
          state.unreadCount += 1;
        }
      }

      // Handle system alerts
      if (notification.type === 'SYSTEM') {
        state.systemAlerts.push({
          id: notification.id,
          severity: notification.metadata.severity || 'info',
          message: notification.message,
          timestamp: notification.timestamp,
          expiresAt: notification.metadata.expiresAt
        });
      }
    })

    // Clean up expired system alerts
    .addMatcher(
      (action) => action.type.startsWith('notification/'),
      (state) => {
        const now = new Date();
        state.systemAlerts = state.systemAlerts.filter(
          alert => !alert.expiresAt || new Date(alert.expiresAt) > now
        );
      }
    );
});

export default notificationReducer;