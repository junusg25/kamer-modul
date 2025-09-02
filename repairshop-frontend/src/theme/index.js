import { createTheme } from '@mui/material/styles';

// Design tokens
const tokens = {
  // Spacing scale (8px base)
  spacing: {
    xs: 4,   // 4px
    sm: 8,   // 8px
    md: 16,  // 16px
    lg: 24,  // 24px
    xl: 32,  // 32px
    xxl: 48, // 48px
  },

  // Typography scale
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },

  // Border radius scale
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Shadow scale
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Color palette
  colors: {
    // Primary colors
    primary: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf9',
      300: '#64b5f6',
      400: '#42a5f5',
      500: '#2196f3',
      600: '#1e88e5',
      700: '#1976d2',
      800: '#1565c0',
      900: '#0d47a1',
    },
    
    // Secondary colors
    secondary: {
      50: '#fce4ec',
      100: '#f8bbd9',
      200: '#f48fb1',
      300: '#f06292',
      400: '#ec407a',
      500: '#e91e63',
      600: '#d81b60',
      700: '#c2185b',
      800: '#ad1457',
      900: '#880e4f',
    },

    // Neutral colors
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },

    // Status colors
    success: {
      50: '#e8f5e8',
      100: '#c8e6c9',
      200: '#a5d6a7',
      300: '#81c784',
      400: '#66bb6a',
      500: '#4caf50',
      600: '#43a047',
      700: '#388e3c',
      800: '#2e7d32',
      900: '#1b5e20',
    },

    warning: {
      50: '#fff8e1',
      100: '#ffecb3',
      200: '#ffe082',
      300: '#ffd54f',
      400: '#ffca28',
      500: '#ffc107',
      600: '#ffb300',
      700: '#ffa000',
      800: '#ff8f00',
      900: '#ff6f00',
    },

    error: {
      50: '#ffebee',
      100: '#ffcdd2',
      200: '#ef9a9a',
      300: '#e57373',
      400: '#ef5350',
      500: '#f44336',
      600: '#e53935',
      700: '#d32f2f',
      800: '#c62828',
      900: '#b71c1c',
    },

    info: {
      50: '#e1f5fe',
      100: '#b3e5fc',
      200: '#81d4fa',
      300: '#4fc3f7',
      400: '#29b6f6',
      500: '#03a9f4',
      600: '#039be5',
      700: '#0288d1',
      800: '#0277bd',
      900: '#01579b',
    }
  }
};

// Create theme function
export const createAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: tokens.colors.primary[600],
        light: tokens.colors.primary[400],
        dark: tokens.colors.primary[800],
        contrastText: '#ffffff',
      },
      secondary: {
        main: tokens.colors.secondary[600],
        light: tokens.colors.secondary[400],
        dark: tokens.colors.secondary[800],
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#0a0a0a' : tokens.colors.gray[50],
        paper: isDark ? '#1a1a1a' : '#ffffff',
        elevated: isDark ? '#2a2a2a' : '#ffffff',
      },
      text: {
        primary: isDark ? tokens.colors.gray[100] : tokens.colors.gray[900],
        secondary: isDark ? tokens.colors.gray[400] : tokens.colors.gray[600],
        disabled: isDark ? tokens.colors.gray[600] : tokens.colors.gray[400],
      },
      divider: isDark ? tokens.colors.gray[800] : tokens.colors.gray[200],
      success: {
        main: tokens.colors.success[600],
        light: tokens.colors.success[400],
        dark: tokens.colors.success[800],
      },
      warning: {
        main: tokens.colors.warning[600],
        light: tokens.colors.warning[400],
        dark: tokens.colors.warning[800],
      },
      error: {
        main: tokens.colors.error[600],
        light: tokens.colors.error[400],
        dark: tokens.colors.error[800],
      },
      info: {
        main: tokens.colors.info[600],
        light: tokens.colors.info[400],
        dark: tokens.colors.info[800],
      },
    },

    typography: {
      fontFamily: tokens.typography.fontFamily,
      h1: {
        fontSize: tokens.typography.fontSizes['4xl'],
        fontWeight: tokens.typography.fontWeights.bold,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: tokens.typography.fontSizes['3xl'],
        fontWeight: tokens.typography.fontWeights.bold,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: tokens.typography.fontSizes['2xl'],
        fontWeight: tokens.typography.fontWeights.semibold,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: tokens.typography.fontSizes.xl,
        fontWeight: tokens.typography.fontWeights.semibold,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: tokens.typography.fontSizes.lg,
        fontWeight: tokens.typography.fontWeights.medium,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: tokens.typography.fontSizes.base,
        fontWeight: tokens.typography.fontWeights.medium,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: tokens.typography.fontSizes.base,
        fontWeight: tokens.typography.fontWeights.normal,
        lineHeight: 1.6,
      },
      body2: {
        fontSize: tokens.typography.fontSizes.sm,
        fontWeight: tokens.typography.fontWeights.normal,
        lineHeight: 1.6,
      },
      caption: {
        fontSize: tokens.typography.fontSizes.xs,
        fontWeight: tokens.typography.fontWeights.normal,
        lineHeight: 1.4,
      },
    },

    shape: {
      borderRadius: tokens.borderRadius.md,
    },

    spacing: 8, // 8px base unit

    components: {
      // Card styling
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark ? tokens.shadows.lg : tokens.shadows.base,
            border: `1px solid ${isDark ? tokens.colors.gray[800] : tokens.colors.gray[200]}`,
            borderRadius: tokens.borderRadius.lg,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: isDark ? tokens.shadows.xl : tokens.shadows.md,
            },
          },
        },
      },

      // Paper styling
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? tokens.colors.gray[800] : tokens.colors.gray[200]}`,
          },
          elevation1: {
            boxShadow: tokens.shadows.sm,
          },
          elevation2: {
            boxShadow: tokens.shadows.base,
          },
          elevation4: {
            boxShadow: tokens.shadows.md,
          },
          elevation8: {
            boxShadow: tokens.shadows.lg,
          },
        },
      },

      // Button styling
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: tokens.typography.fontWeights.medium,
            borderRadius: tokens.borderRadius.md,
            padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
            fontSize: tokens.typography.fontSizes.sm,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            boxShadow: tokens.shadows.sm,
            '&:hover': {
              boxShadow: tokens.shadows.md,
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
            },
          },
          sizeSmall: {
            padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            fontSize: tokens.typography.fontSizes.xs,
          },
          sizeLarge: {
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.typography.fontSizes.base,
          },
        },
      },

      // TextField styling
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: tokens.borderRadius.md,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isDark ? tokens.colors.gray[600] : tokens.colors.gray[400],
                },
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                },
              },
            },
            '& .MuiInputLabel-root': {
              fontWeight: tokens.typography.fontWeights.medium,
            },
          },
        },
      },

      // Chip styling
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.full,
            fontWeight: tokens.typography.fontWeights.medium,
            fontSize: tokens.typography.fontSizes.xs,
          },
          outlined: {
            borderWidth: '1.5px',
          },
        },
      },

      // Table styling
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.lg,
            border: `1px solid ${isDark ? tokens.colors.gray[800] : tokens.colors.gray[200]}`,
          },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? tokens.colors.gray[900] : tokens.colors.gray[50],
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: tokens.typography.fontWeights.semibold,
            fontSize: tokens.typography.fontSizes.sm,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isDark ? tokens.colors.gray[300] : tokens.colors.gray[700],
          },
          body: {
            fontSize: tokens.typography.fontSizes.sm,
          },
        },
      },

      // Dialog styling
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.borderRadius.xl,
            boxShadow: tokens.shadows.xl,
          },
        },
      },

      // Alert styling
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.md,
            fontWeight: tokens.typography.fontWeights.medium,
          },
        },
      },

      // AppBar styling
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${isDark ? tokens.colors.gray[800] : tokens.colors.gray[200]}`,
            backgroundColor: isDark ? tokens.colors.gray[900] : '#ffffff',
            color: isDark ? tokens.colors.gray[100] : tokens.colors.gray[900],
          },
        },
      },

      // Drawer styling
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${isDark ? tokens.colors.gray[800] : tokens.colors.gray[200]}`,
            backgroundColor: isDark ? tokens.colors.gray[900] : '#ffffff',
          },
        },
      },

      // List styling
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.borderRadius.md,
            margin: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: isDark ? tokens.colors.gray[800] : tokens.colors.gray[100],
              transform: 'translateX(4px)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? tokens.colors.primary[900] : tokens.colors.primary[50],
              color: tokens.colors.primary[600],
              '&:hover': {
                backgroundColor: isDark ? tokens.colors.primary[800] : tokens.colors.primary[100],
              },
            },
          },
        },
      },
    },
  });
};

export { tokens };
export default createAppTheme;
