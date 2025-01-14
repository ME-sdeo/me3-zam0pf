import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  IconButton, 
  useTheme, 
  useMediaQuery,
  styled
} from '@mui/material'; // @mui/material ^5.0.0
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material'; // @mui/icons-material ^5.0.0

import { CONSUMER_ROUTES, COMPANY_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth.types';

// Constants for enhanced navigation and styling
const DRAWER_WIDTH = 280;

// Styled components for enhanced visual hierarchy
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Interface definitions
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactElement;
  ariaLabel: string;
  requiredRole: UserRole;
}

// Navigation items with role-based access control
const CONSUMER_NAV_ITEMS: NavItem[] = [
  {
    path: CONSUMER_ROUTES.DASHBOARD,
    label: 'Dashboard',
    icon: <DashboardIcon />,
    ariaLabel: 'Navigate to dashboard',
    requiredRole: UserRole.CONSUMER
  },
  {
    path: CONSUMER_ROUTES.HEALTH_RECORDS,
    label: 'Health Records',
    icon: <FolderIcon />,
    ariaLabel: 'Manage health records',
    requiredRole: UserRole.CONSUMER
  },
  {
    path: CONSUMER_ROUTES.SETTINGS,
    label: 'Settings',
    icon: <SettingsIcon />,
    ariaLabel: 'Access settings',
    requiredRole: UserRole.CONSUMER
  }
];

const COMPANY_NAV_ITEMS: NavItem[] = [
  {
    path: COMPANY_ROUTES.DASHBOARD,
    label: 'Dashboard',
    icon: <DashboardIcon />,
    ariaLabel: 'Navigate to dashboard',
    requiredRole: UserRole.COMPANY
  },
  {
    path: COMPANY_ROUTES.DATA_REQUESTS,
    label: 'Data Requests',
    icon: <FolderIcon />,
    ariaLabel: 'Manage data requests',
    requiredRole: UserRole.COMPANY
  },
  {
    path: COMPANY_ROUTES.SETTINGS,
    label: 'Settings',
    icon: <SettingsIcon />,
    ariaLabel: 'Access settings',
    requiredRole: UserRole.COMPANY
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, className }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  // Responsive layout handling
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Memoized navigation items based on user role
  const navigationItems = useMemo(() => {
    if (!user || !isAuthenticated) return [];
    return user.role === UserRole.COMPANY ? COMPANY_NAV_ITEMS : CONSUMER_NAV_ITEMS;
  }, [user, isAuthenticated]);

  // Enhanced navigation handler with security checks
  const handleNavigation = useCallback((path: string, ariaLabel: string) => {
    if (!isAuthenticated) {
      console.error('Unauthorized navigation attempt');
      return;
    }

    navigate(path);
    if (isMobile) {
      onClose();
    }
    
    // Announce navigation for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Navigated to ${ariaLabel}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [navigate, isAuthenticated, isMobile, onClose]);

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={isOpen}
      onClose={onClose}
      className={className}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
      aria-label="Navigation sidebar"
    >
      <DrawerHeader>
        <IconButton 
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>

      <List
        component="nav"
        aria-label="Main navigation"
        sx={{ padding: theme.spacing(2) }}
      >
        {navigationItems.map((item) => (
          <ListItem
            button
            key={item.path}
            onClick={() => handleNavigation(item.path, item.ariaLabel)}
            selected={location.pathname === item.path}
            aria-label={item.ariaLabel}
            sx={{
              borderRadius: 1,
              mb: 1,
              '&.Mui-selected': {
                backgroundColor: theme.palette.primary.light,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: location.pathname === item.path ? 
                  theme.palette.primary.main : 
                  theme.palette.text.secondary,
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label}
              primaryTypographyProps={{
                variant: 'body2',
                color: location.pathname === item.path ? 
                  'primary' : 
                  'textPrimary',
              }}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;