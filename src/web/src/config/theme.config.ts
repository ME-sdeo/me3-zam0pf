import { createTheme, useMediaQuery, PaletteMode } from '@mui/material';
import { lightTheme, darkTheme } from '../styles/themes';

// Theme mode type definition
export type ThemeMode = 'light' | 'dark' | 'system';

// Theme storage key for persisting user preference
const THEME_STORAGE_KEY = 'theme-mode';

// Animation duration for theme transitions
const TRANSITION_DURATION = '0.3s';

/**
 * Detects system color scheme preference
 * @returns {ThemeMode} System theme preference
 */
export const getSystemPreference = (): ThemeMode => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  return prefersDarkMode ? 'dark' : 'light';
};

/**
 * Creates an accessible Material UI theme configuration
 * @param {ThemeMode} mode - Theme mode (light/dark/system)
 * @returns {Theme} Material UI theme configuration
 */
export const getThemeConfig = (mode: ThemeMode) => {
  const effectiveMode = mode === 'system' ? getSystemPreference() : mode;
  const themeSource = effectiveMode === 'dark' ? darkTheme : lightTheme;

  return createTheme({
    palette: {
      mode: effectiveMode as PaletteMode,
      primary: {
        main: themeSource.colors.primary.main,
        light: themeSource.colors.primary.light,
        dark: themeSource.colors.primary.dark,
        contrastText: themeSource.colors.primary.contrast,
      },
      secondary: {
        main: themeSource.colors.secondary.main,
        light: themeSource.colors.secondary.light,
        dark: themeSource.colors.secondary.dark,
        contrastText: themeSource.colors.secondary.contrast,
      },
      success: {
        main: themeSource.colors.semantic.success,
        contrastText: effectiveMode === 'dark' ? '#000000' : '#FFFFFF',
      },
      error: {
        main: themeSource.colors.semantic.error,
        contrastText: effectiveMode === 'dark' ? '#000000' : '#FFFFFF',
      },
      warning: {
        main: themeSource.colors.semantic.warning,
        contrastText: '#000000',
      },
      background: {
        default: themeSource.colors.background.default,
        paper: themeSource.colors.background.paper,
      },
      text: {
        primary: themeSource.colors.text.primary,
        secondary: themeSource.colors.text.secondary,
        disabled: themeSource.colors.text.disabled,
      },
    },
    typography: {
      fontFamily: "'Roboto', 'Open Sans', sans-serif",
      h1: {
        fontSize: '2.5rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.01562em',
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: '-0.00833em',
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: '0em',
      },
      body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0.00938em',
      },
      body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: '0.01071em',
      },
      button: {
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.02857em',
        textTransform: 'uppercase',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: `background-color ${TRANSITION_DURATION} ease-in-out`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: '44px', // WCAG touch target size
            borderRadius: '4px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiLink: {
        defaultProps: {
          underline: 'hover',
        },
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `3px solid ${themeSource.accessibility.focusRing[effectiveMode]}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: '12px', // Ensures minimum touch target size
          },
        },
      },
    },
    shape: {
      borderRadius: 4,
    },
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
  });
};

// Default theme configuration
export const themeConfig = {
  defaultMode: 'system' as ThemeMode,
  storageKey: THEME_STORAGE_KEY,
  transitionDuration: TRANSITION_DURATION,
  accessibility: {
    minTouchTarget: 44,
    focusRingWidth: 3,
    highContrastSupport: true,
  },
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
};

export default getThemeConfig;