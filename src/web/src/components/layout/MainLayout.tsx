import React, { useState, useCallback } from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material'; // ^5.0.0
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

// Constants for layout configuration
const DRAWER_WIDTH = 280;
const MOBILE_BREAKPOINT = 'sm';
const TRANSITION_DURATION = 225;

/**
 * Props interface for MainLayout component
 */
interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * Main layout component that provides the core structure for the MyElixir platform
 * Implements Material Design 3.0 with responsive behavior and accessibility features
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  /**
   * Handles sidebar toggle with proper focus management
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.sharp,
          duration: TRANSITION_DURATION,
        }),
      }}
      role="application"
    >
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="skip-link"
        style={{
          position: 'absolute',
          top: -40,
          left: 0,
          padding: theme.spacing(1),
          backgroundColor: theme.palette.background.paper,
          zIndex: theme.zIndex.modal + 1,
          transition: 'top 0.2s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.top = '0';
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = '-40px';
        }}
      >
        Skip to main content
      </a>

      {/* Header with menu toggle */}
      <Header 
        onThemeChange={undefined}
        onSecurityAlert={undefined}
      />

      {/* Navigation sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarToggle}
        className="main-sidebar"
      />

      {/* Main content area */}
      <Box
        component="main"
        id="main-content"
        role="main"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          width: {
            sm: `calc(100% - ${isSidebarOpen ? DRAWER_WIDTH : 0}px)`,
          },
          marginLeft: {
            sm: isSidebarOpen ? `${DRAWER_WIDTH}px` : 0,
          },
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: TRANSITION_DURATION,
          }),
          outline: 'none', // Remove focus outline while keeping it focusable
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Footer />

      <style>
        {`
          .skip-link {
            color: ${theme.palette.primary.main};
            text-decoration: none;
            font-weight: 500;
          }

          .skip-link:focus {
            outline: 2px solid ${theme.palette.primary.main};
            outline-offset: 2px;
          }

          @media (prefers-contrast: high) {
            .skip-link:focus {
              outline: 4px solid currentColor;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            * {
              transition-duration: 0.01ms !important;
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default MainLayout;