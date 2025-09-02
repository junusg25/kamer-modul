import React from 'react';
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Paper,
  Container,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import SearchField from '../common/SearchField';

/**
 * Standardized page layout component for consistent page structure
 */
const PageLayout = ({
  // Page identity
  title,
  subtitle,
  breadcrumbs = [],
  
  // Actions
  primaryAction,
  secondaryActions = [],
  
  // Search and filters
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch = false,
  
  // Filters
  showFilters = false,
  filtersActive = false,
  onFiltersToggle,
  filterComponent,
  
  // View options
  viewMode = 'list', // 'list', 'grid', 'table'
  onViewModeChange,
  showViewToggle = false,
  
  // Loading and refresh
  loading = false,
  onRefresh,
  
  // Navigation
  showBackButton = false,
  onBack,
  
  // Layout options
  maxWidth = 'lg',
  disableGutters = false,
  
  // Content
  children,
  
  // Stats/metrics (optional)
  stats = [],
  
  ...props
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const renderBreadcrumbs = () => {
    if (breadcrumbs.length === 0) return null;

    return (
      <Breadcrumbs sx={{ mb: 1 }}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          if (isLast || !crumb.href) {
            return (
              <Typography key={index} color="text.primary" variant="body2">
                {crumb.label}
              </Typography>
            );
          }
          
          return (
            <Link
              key={index}
              color="inherit"
              href={crumb.href}
              onClick={(e) => {
                if (crumb.onClick) {
                  e.preventDefault();
                  crumb.onClick();
                }
              }}
              variant="body2"
              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {crumb.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    );
  };

  const renderStats = () => {
    if (stats.length === 0) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              sx={{
                p: 2,
                textAlign: 'center',
                background: stat.color ? alpha(theme.palette[stat.color].main, 0.1) : 'background.paper',
                border: stat.color ? `1px solid ${alpha(theme.palette[stat.color].main, 0.3)}` : undefined,
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color ? `${stat.color}.main` : 'text.primary' }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
              {stat.change && (
                <Chip
                  label={stat.change}
                  size="small"
                  color={stat.changeType === 'increase' ? 'success' : stat.changeType === 'decrease' ? 'error' : 'default'}
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderHeader = () => (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      {renderBreadcrumbs()}
      
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        {/* Back button */}
        {showBackButton && (
          <IconButton onClick={handleBack} sx={{ mt: 0.5 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        
        {/* Title and subtitle */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {/* Primary action */}
        {primaryAction && (
          <Button
            variant="contained"
            startIcon={primaryAction.icon}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            sx={{ flexShrink: 0 }}
          >
            {primaryAction.label}
          </Button>
        )}
      </Box>
      
      {/* Controls row */}
      {(showSearch || showFilters || secondaryActions.length > 0 || onRefresh || showViewToggle) && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          {showSearch && (
            <Box sx={{ flex: 1, minWidth: 300 }}>
              <SearchField
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                showFilters={showFilters}
                filtersActive={filtersActive}
                onFiltersClick={onFiltersToggle}
                size="small"
              />
            </Box>
          )}
          
          {/* Secondary actions */}
          {secondaryActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outlined'}
              color={action.color || 'primary'}
              startIcon={action.icon}
              onClick={action.onClick}
              disabled={action.disabled}
              size="small"
            >
              {action.label}
            </Button>
          ))}
          
          {/* View toggle */}
          {showViewToggle && (
            <Box sx={{ display: 'flex', border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
              <IconButton
                size="small"
                onClick={() => onViewModeChange?.('list')}
                color={viewMode === 'list' ? 'primary' : 'default'}
                sx={{ borderRadius: 0 }}
              >
                <ViewListIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => onViewModeChange?.('grid')}
                color={viewMode === 'grid' ? 'primary' : 'default'}
                sx={{ borderRadius: 0 }}
              >
                <ViewModuleIcon />
              </IconButton>
            </Box>
          )}
          
          {/* Refresh button */}
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
      
      {/* Filter component */}
      {filterComponent && filtersActive && (
        <Box sx={{ mt: 2 }}>
          {filterComponent}
        </Box>
      )}
    </Box>
  );

  return (
    <Container
      maxWidth={maxWidth}
      disableGutters={disableGutters}
      sx={{ py: 3 }}
      {...props}
    >
      {renderHeader()}
      {renderStats()}
      {children}
    </Container>
  );
};

export default PageLayout;
