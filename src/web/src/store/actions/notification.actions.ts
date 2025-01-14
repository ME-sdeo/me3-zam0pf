import { createAction, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import NotificationService from '../../services/notification.service';

// Action Types
export enum NotificationActionTypes {
  FETCH_NOTIFICATIONS_START = 'notification/fetchNotifications/pending',
  FETCH_NOTIFICATIONS_SUCCESS = 'notification/fetchNotifications/fulfilled',
  FETCH_NOTIFICATIONS_FAILURE = 'notification/fetchNotifications/rejected',
  MARK_AS_READ_START = 'notification/markAsRead/pending',
  MARK_AS_READ_SUCCESS = 'notification/markAsRead/fulfilled',
  MARK_AS_READ_FAILURE = 'notification/markAsRead/rejected',
  DELETE_NOTIFICATION_START = 'notification/deleteNotification/pending',
  DELETE_NOTIFICATION_SUCCESS = 'notification/deleteNotification/fulfilled',
  DELETE_NOTIFICATION_FAILURE = 'notification/deleteNotification/rejected',
  UPDATE_PREFERENCES_START = 'notification/updatePreferences/pending',
  UPDATE_PREFERENCES_SUCCESS = 'notification/updatePreferences/fulfilled',
  UPDATE_PREFERENCES_FAILURE = 'notification/updatePreferences/rejected',
  WEBSOCKET_CONNECTED = 'notification/websocket/connected',
  WEBSOCKET_DISCONNECTED = 'notification/websocket/disconnected',
  WEBSOCKET_MESSAGE = 'notification/websocket/message',
  WEBSOCKET_ERROR = 'notification/websocket/error'
}

// Action Creators
export const fetchNotifications = createAsyncThunk<
  NotificationResponse,
  { page: number; limit: number; forceRefresh?: boolean }
>(
  NotificationActionTypes.FETCH_NOTIFICATIONS_START,
  async ({ page, limit, forceRefresh = false }, { rejectWithValue }) => {
    try {
      const notificationService = NotificationService.getInstance();
      const response = await notificationService.getNotifications(page, limit);
      return response;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

export const markAsRead = createAsyncThunk<void, string>(
  NotificationActionTypes.MARK_AS_READ_START,
  async (notificationId, { rejectWithValue }) => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.markAsRead(notificationId);
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

export const deleteNotification = createAsyncThunk<void, string>(
  NotificationActionTypes.DELETE_NOTIFICATION_START,
  async (notificationId, { rejectWithValue }) => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.deleteNotification(notificationId);
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

export const updatePreferences = createAsyncThunk<void, NotificationPreferences>(
  NotificationActionTypes.UPDATE_PREFERENCES_START,
  async (preferences, { rejectWithValue }) => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.updatePreferences(preferences);
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// WebSocket Actions
export const websocketConnected = createAction(
  NotificationActionTypes.WEBSOCKET_CONNECTED
);

export const websocketDisconnected = createAction(
  NotificationActionTypes.WEBSOCKET_DISCONNECTED
);

export const websocketMessage = createAction<Notification>(
  NotificationActionTypes.WEBSOCKET_MESSAGE
);

export const websocketError = createAction<Error>(
  NotificationActionTypes.WEBSOCKET_ERROR
);

// WebSocket Initialization Action
export const initializeWebSocket = createAsyncThunk(
  'notification/initializeWebSocket',
  async (_, { dispatch }) => {
    const notificationService = NotificationService.getInstance();
    const userId = localStorage.getItem('user_id');

    if (!userId) {
      throw new Error('User ID not found');
    }

    await notificationService.connectWebSocket(userId, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    // Set up WebSocket event listeners
    window.addEventListener('new-notification', ((event: CustomEvent) => {
      dispatch(websocketMessage(event.detail));
    }) as EventListener);

    window.addEventListener('notification-unauthorized', () => {
      dispatch(websocketDisconnected());
    });

    dispatch(websocketConnected());
  }
);

// Types
interface NotificationResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface Notification {
  id: string;
  type: 'REQUEST' | 'CONSENT' | 'PAYMENT' | 'SYSTEM';
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  read: boolean;
}

interface NotificationPreferences {
  [key: string]: boolean;
}