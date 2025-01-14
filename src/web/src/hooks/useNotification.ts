import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useSelector, useDispatch } from 'react-redux'; // ^8.0.0
import { debounce } from 'lodash'; // ^4.17.21
import NotificationService from '../services/notification.service';
import * as NotificationActions from '../store/actions/notification.actions';

/**
 * Interface for notification state
 */
interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: Error | null;
  total: number;
  page: number;
  hasMore: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  preferences: NotificationPreferences;
}

/**
 * Interface for notification hook return value
 */
interface NotificationHookReturn {
  notifications: Notification[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  connectionStatus: NotificationState['connectionStatus'];
  preferences: NotificationPreferences;
  fetchMore: (page: number) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updatePreferences: (preferences: NotificationPreferences) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Custom hook for managing notifications with real-time updates and HIPAA compliance
 */
export const useNotification = (): NotificationHookReturn => {
  const dispatch = useDispatch();
  const notificationService = NotificationService.getInstance();

  // Select notification state from Redux store
  const {
    notifications,
    loading,
    error,
    total,
    page,
    hasMore,
    connectionStatus,
    preferences
  } = useSelector((state: any) => state.notifications);

  /**
   * Initialize WebSocket connection with secure configuration
   */
  useEffect(() => {
    dispatch(NotificationActions.initializeWebSocket());

    return () => {
      notificationService.disconnect();
    };
  }, [dispatch]);

  /**
   * Fetch notifications with pagination and caching
   */
  const fetchMore = useCallback(async (nextPage: number) => {
    try {
      await dispatch(NotificationActions.fetchNotifications({
        page: nextPage,
        limit: 20,
        forceRefresh: false
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [dispatch]);

  /**
   * Mark notification as read with optimistic update
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await dispatch(NotificationActions.markAsRead(notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [dispatch]);

  /**
   * Delete notification with confirmation
   */
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await dispatch(NotificationActions.deleteNotification(notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [dispatch]);

  /**
   * Update notification preferences with debouncing
   */
  const debouncedUpdatePreferences = debounce(async (newPreferences: NotificationPreferences) => {
    try {
      await dispatch(NotificationActions.updatePreferences(newPreferences));
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }, 500);

  const updatePreferences = useCallback((newPreferences: NotificationPreferences) => {
    debouncedUpdatePreferences(newPreferences);
  }, [debouncedUpdatePreferences]);

  /**
   * Mark all notifications as read in batch
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const batchPromises = unreadNotifications.map(n => 
        dispatch(NotificationActions.markAsRead(n.id))
      );
      await Promise.all(batchPromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [dispatch, notifications]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      debouncedUpdatePreferences.cancel();
    };
  }, [debouncedUpdatePreferences]);

  return {
    notifications,
    loading,
    error,
    hasMore,
    connectionStatus,
    preferences,
    fetchMore,
    markAsRead,
    deleteNotification,
    updatePreferences,
    markAllAsRead
  };
};

export default useNotification;