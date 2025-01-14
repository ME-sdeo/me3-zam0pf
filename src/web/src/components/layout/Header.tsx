import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@mui/material';
import {
  Menu,
  Person,
  Notifications,
  Settings,
  Security
} from '@mui/icons-material';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { Notification } from '../common/Notification';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from 'react-use-websocket';
import { NotificationType, NotificationPriority } from '../common/Notification';
import { UserRole, AuthStatus } from '../../types/auth.types';

interface HeaderProps {
  onThemeChange?: () => void;
  onSecurityAlert?: (alert: SecurityAlert) => void;
}

interface SecurityAlert {
  type: 'MFA_REQUIRED' | 'SESSION_EXPIRING' | 'SUSPICIOUS_ACTIVITY';
  message: string;
  severity: 'warning' | 'error';
}

const Header: React.FC<HeaderProps> = ({ onThemeChange, onSecurityAlert }) => {
  // State management
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [blockchainStatus, setBlockchainStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  // Hooks
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    user, 
    logout, 
    mfaStatus, 
    sessionInfo 
  } = useAuth();

  // WebSocket setup for real-time notifications
  const { 
    sendMessage,
    lastMessage,
    readyState 
  } = useWebSocket(process.env.REACT_APP_WS_URL || 'wss://api.myelixir.com/ws', {
    shouldReconnect: () => true,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  // Profile menu items
  const profileMenuItems = [
    {
      id: 'profile',
      label: 'My Profile',
      value: 'profile',
      icon: <Person />,
    },
    {
      id: 'settings',
      label: 'Settings',
      value: 'settings',
      icon: <Settings />,
    },
    {
      id: 'security',
      label: 'Security Settings',
      value: 'security',
      icon: <Security />,
    },
    {
      id: 'logout',
      label: 'Logout',
      value: 'logout',
      icon: <Menu />,
    },
  ];

  // Handle profile menu selection
  const handleProfileMenuSelect = useCallback(async (item: { value: string }) => {
    switch (item.value) {
      case 'profile':
        navigate('/profile');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'security':
        navigate('/security');
        break;
      case 'logout':
        try {
          await logout();
          navigate('/login');
        } catch (error) {
          console.error('Logout failed:', error);
        }
        break;
    }
  }, [navigate, logout]);

  // Handle notification click
  const handleNotificationClick = useCallback(() => {
    setNotificationsOpen(!isNotificationsOpen);
  }, [isNotificationsOpen]);

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const notification = JSON.parse(lastMessage.data);
        if (notification.type === 'SECURITY_ALERT') {
          onSecurityAlert?.(notification.payload);
        }
        setUnreadNotifications(prev => prev + 1);
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }
  }, [lastMessage, onSecurityAlert]);

  // Monitor session status
  useEffect(() => {
    if (sessionInfo?.expiresIn) {
      const timeUntilExpiry = sessionInfo.expiresIn - Date.now();
      if (timeUntilExpiry < 300000) { // 5 minutes
        onSecurityAlert?.({
          type: 'SESSION_EXPIRING',
          message: 'Your session will expire soon. Please save your work.',
          severity: 'warning'
        });
      }
    }
  }, [sessionInfo, onSecurityAlert]);

  return (
    <header className="header" role="banner">
      <div className="header__container">
        {/* Logo and Navigation */}
        <div className="header__left">
          <div className="header__logo" onClick={() => navigate('/')} role="button" tabIndex={0}>
            <img 
              src="/logo.svg" 
              alt="MyElixir Logo" 
              className="header__logo-image"
            />
          </div>

          {isAuthenticated && (
            <nav className="header__nav" role="navigation">
              <Button
                variant="text"
                onClick={() => navigate('/dashboard')}
                aria-label="Dashboard"
              >
                Dashboard
              </Button>
              {user?.role === UserRole.CONSUMER && (
                <Button
                  variant="text"
                  onClick={() => navigate('/my-data')}
                  aria-label="My Health Data"
                >
                  My Health Data
                </Button>
              )}
              {user?.role === UserRole.COMPANY && (
                <Button
                  variant="text"
                  onClick={() => navigate('/marketplace')}
                  aria-label="Data Marketplace"
                >
                  Marketplace
                </Button>
              )}
            </nav>
          )}
        </div>

        {/* User Actions */}
        {isAuthenticated && (
          <div className="header__right">
            {/* Blockchain Status Indicator */}
            <div 
              className={`header__blockchain-status header__blockchain-status--${blockchainStatus}`}
              role="status"
              aria-label={`Blockchain status: ${blockchainStatus}`}
            >
              <span className="header__blockchain-indicator" />
              {blockchainStatus === 'syncing' && 'Syncing...'}
            </div>

            {/* Notifications */}
            <IconButton
              onClick={handleNotificationClick}
              aria-label={`Notifications ${unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}`}
              className="header__notification-button"
            >
              <Notifications />
              {unreadNotifications > 0 && (
                <span className="header__notification-badge" aria-hidden="true">
                  {unreadNotifications}
                </span>
              )}
            </IconButton>

            {/* Profile Menu */}
            <Dropdown
              trigger={
                <IconButton
                  aria-label="User menu"
                  className="header__profile-button"
                >
                  <Person />
                </IconButton>
              }
              items={profileMenuItems}
              onSelect={handleProfileMenuSelect}
              placement="bottom-end"
              aria-label="User menu dropdown"
            />

            {/* MFA Status Indicator */}
            {mfaStatus?.required && !mfaStatus?.verified && (
              <div 
                className="header__mfa-warning"
                role="alert"
                aria-live="polite"
              >
                MFA Required
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;