import { io, Socket } from 'socket.io-client'; // ^4.6.0
import { Logger, createLogger, format } from 'winston'; // ^3.8.0
import NodeCache from 'node-cache'; // ^5.1.2
import axiosInstance from '../utils/api.util';
import { apiConfig } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Interface for notification data structure
 */
interface Notification {
  id: string;
  type: 'REQUEST' | 'CONSENT' | 'PAYMENT' | 'SYSTEM';
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  read: boolean;
}

/**
 * Interface for notification filter options
 */
interface NotificationFilter {
  type?: string[];
  startDate?: Date;
  endDate?: Date;
  read?: boolean;
}

/**
 * Interface for paginated notification response
 */
interface NotificationResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Interface for WebSocket connection options
 */
interface ConnectionOptions {
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  secure: boolean;
}

/**
 * Enhanced notification service with caching, security, and reliability features
 */
class NotificationService {
  private static instance: NotificationService;
  private socket: Socket | null = null;
  private readonly cache: NodeCache;
  private readonly logger: Logger;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly CACHE_TTL = 300; // 5 minutes

  private constructor() {
    // Initialize cache with reasonable TTL and checking period
    this.cache = new NodeCache({
      stdTTL: this.CACHE_TTL,
      checkperiod: 60,
      useClones: false
    });

    // Initialize logger
    this.logger = createLogger({
      level: 'info',
      format: format.json(),
      defaultMeta: { service: 'notification-service' }
    });

    // Set up cache error handling
    this.cache.on('error', (err: Error) => {
      this.logger.error('Cache error:', err);
    });
  }

  /**
   * Gets singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Fetches paginated notifications with caching support
   */
  public async getNotifications(
    page: number = 1,
    limit: number = 20,
    filters?: NotificationFilter
  ): Promise<NotificationResponse> {
    const cacheKey = `notifications_${page}_${limit}_${JSON.stringify(filters)}`;
    const cachedData = this.cache.get<NotificationResponse>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axiosInstance.get(API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS, {
        params: {
          page,
          limit,
          ...filters
        }
      });

      const notificationResponse = response.data as NotificationResponse;
      this.cache.set(cacheKey, notificationResponse);
      return notificationResponse;
    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Marks notification as read with optimistic update
   */
  public async markAsRead(notificationId: string): Promise<void> {
    try {
      await axiosInstance.put(
        `${API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS}/${notificationId}/read`
      );
      this.updateCachedNotification(notificationId, { read: true });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Establishes secure WebSocket connection with retry mechanism
   */
  public async connectWebSocket(userId: string, options: Partial<ConnectionOptions> = {
    reconnection: true,
    reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    secure: true
  }): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    
    this.socket = io(wsUrl, {
      transports: ['websocket'],
      rejectUnauthorized: true,
      auth: {
        userId,
        token: localStorage.getItem('auth_token')
      },
      ...options
    });

    this.setupSocketEventHandlers();
  }

  /**
   * Disconnects WebSocket connection
   */
  public disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Updates notification preferences
   */
  public async updatePreferences(preferences: Record<string, boolean>): Promise<void> {
    try {
      await axiosInstance.put(
        `${API_ENDPOINTS.MARKETPLACE.NOTIFICATIONS}/preferences`,
        preferences
      );
    } catch (error) {
      this.logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Sets up WebSocket event handlers with security and reliability features
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.logger.info('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('notification', (notification: Notification) => {
      this.handleNewNotification(notification);
    });

    this.socket.on('error', (error: Error) => {
      this.logger.error('WebSocket error:', error);
      this.handleSocketError(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.logger.warn('WebSocket disconnected:', reason);
      this.handleDisconnect(reason);
    });

    // Handle potential security events
    this.socket.on('unauthorized', (error: Error) => {
      this.logger.error('WebSocket unauthorized:', error);
      this.handleUnauthorized();
    });
  }

  /**
   * Handles new notification arrival with cache update
   */
  private handleNewNotification(notification: Notification): void {
    // Update cache with new notification
    const cacheKeys = this.cache.keys();
    cacheKeys.forEach((key: string) => {
      if (key.startsWith('notifications_')) {
        const cached = this.cache.get<NotificationResponse>(key);
        if (cached) {
          cached.notifications.unshift(notification);
          cached.total += 1;
          this.cache.set(key, cached);
        }
      }
    });

    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('new-notification', {
      detail: notification
    }));
  }

  /**
   * Updates cached notification data
   */
  private updateCachedNotification(
    notificationId: string,
    updates: Partial<Notification>
  ): void {
    const cacheKeys = this.cache.keys();
    cacheKeys.forEach((key: string) => {
      if (key.startsWith('notifications_')) {
        const cached = this.cache.get<NotificationResponse>(key);
        if (cached) {
          cached.notifications = cached.notifications.map(notification =>
            notification.id === notificationId
              ? { ...notification, ...updates }
              : notification
          );
          this.cache.set(key, cached);
        }
      }
    });
  }

  /**
   * Handles WebSocket connection errors with retry logic
   */
  private handleSocketError(error: Error): void {
    this.logger.error('Socket error:', error);
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.socket?.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }

  /**
   * Handles WebSocket disconnection scenarios
   */
  private handleDisconnect(reason: string): void {
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, don't reconnect
      this.disconnect();
    } else if (reason === 'transport close') {
      // Connection lost, attempt reconnect
      this.handleSocketError(new Error('Transport closed'));
    }
  }

  /**
   * Handles unauthorized WebSocket connection
   */
  private handleUnauthorized(): void {
    this.disconnect();
    window.dispatchEvent(new CustomEvent('notification-unauthorized'));
  }

  /**
   * Gets secure WebSocket URL based on environment
   */
  private getWebSocketUrl(): string {
    const baseUrl = apiConfig.baseURL.replace(/^http/, 'ws');
    return `${baseUrl}/notifications`;
  }
}

export default NotificationService;