import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Alert,
  CircularProgress,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

/**
 * Standardized form layout component with consistent styling and behavior
 */
const FormLayout = ({
  // Content
  title,
  subtitle,
  children,
  
  // Steps (for multi-step forms)
  steps = [],
  activeStep = 0,
  
  // Actions
  actions = [],
  primaryAction,
  secondaryAction,
  
  // State
  loading = false,
  error = null,
  success = null,
  warning = null,
  info = null,
  
  // Layout options
  layout = 'single', // 'single', 'sidebar', 'tabs'
  maxWidth = 'md',
  fullHeight = false,
  
  // Sidebar content (for sidebar layout)
  sidebarContent,
  sidebarWidth = 300,
  
  // Navigation
  showBackButton = false,
  onBack,
  
  // Form state indicators
  isDirty = false,
  isValid = true,
  
  // Additional props
  ...props
}) => {
  const theme = useTheme();

  const renderAlert = (severity, message, icon) => {
    if (!message) return null;
    
    return (
      <Alert 
        severity={severity} 
        icon={icon}
        sx={{ mb: 2 }}
        onClose={severity !== 'error' ? () => {} : undefined}
      >
        {message}
      </Alert>
    );
  };

  const renderActions = () => {
    if (actions.length === 0 && !primaryAction && !secondaryAction) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Form state indicators */}
        {isDirty && (
          <Chip
            size="small"
            label="Unsaved changes"
            color="warning"
            variant="outlined"
            icon={<WarningIcon />}
          />
        )}
        
        {/* Secondary action */}
        {secondaryAction && (
          <Button
            variant="outlined"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled || loading}
            startIcon={secondaryAction.icon}
          >
            {secondaryAction.label}
          </Button>
        )}
        
        {/* Custom actions */}
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'text'}
            color={action.color || 'primary'}
            onClick={action.onClick}
            disabled={action.disabled || loading}
            startIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
        
        {/* Primary action */}
        {primaryAction && (
          <Button
            variant="contained"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || !isValid || loading}
            startIcon={loading ? <CircularProgress size={16} /> : primaryAction.icon}
          >
            {primaryAction.label}
          </Button>
        )}
      </Box>
    );
  };

  const renderHeader = () => (
    <Box sx={{ mb: 3 }}>
      {/* Back button and title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        {showBackButton && (
          <IconButton onClick={onBack} size="small">
            <ArrowBackIcon />
          </IconButton>
        )}
        
        <Box sx={{ flex: 1 }}>
          {title && (
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Multi-step progress */}
      {steps.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}
    </Box>
  );

  const renderContent = () => {
    switch (layout) {
      case 'sidebar':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, height: 'fit-content' }}>
                {children}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: 'fit-content', position: 'sticky', top: 24 }}>
                {sidebarContent}
              </Paper>
            </Grid>
          </Grid>
        );

      case 'card':
        return (
          <Card>
            <CardContent sx={{ p: 3 }}>
              {children}
            </CardContent>
            {renderActions() && (
              <CardActions sx={{ p: 3, pt: 0 }}>
                {renderActions()}
              </CardActions>
            )}
          </Card>
        );

      default:
        return (
          <Paper sx={{ p: 3 }}>
            {children}
            {renderActions() && (
              <>
                <Divider sx={{ my: 3 }} />
                {renderActions()}
              </>
            )}
          </Paper>
        );
    }
  };

  return (
    <Container
      maxWidth={maxWidth}
      sx={{
        py: 3,
        minHeight: fullHeight ? '100vh' : 'auto',
        display: fullHeight ? 'flex' : 'block',
        flexDirection: 'column',
      }}
      {...props}
    >
      {renderHeader()}
      
      {/* Alerts */}
      {renderAlert('error', error, <ErrorIcon />)}
      {renderAlert('warning', warning, <WarningIcon />)}
      {renderAlert('info', info, <InfoIcon />)}
      {renderAlert('success', success, <CheckIcon />)}
      
      {/* Main content */}
      <Box sx={{ flex: fullHeight ? 1 : 'none' }}>
        {renderContent()}
      </Box>
    </Container>
  );
};

export default FormLayout;
