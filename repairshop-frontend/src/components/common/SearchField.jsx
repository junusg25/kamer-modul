import React from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Autocomplete,
  Chip,
  Paper,
  Typography,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  TuneOutlined as TuneIcon,
} from '@mui/icons-material';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Standardized search field component with advanced features
 */
const SearchField = ({
  // Basic props
  value = '',
  onChange,
  onSearch,
  placeholder = 'Search...',
  
  // Styling
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  
  // Advanced features
  suggestions = [],
  recentSearches = [],
  showRecentSearches = true,
  showSuggestions = true,
  clearable = true,
  debounceMs = 300,
  
  // Filter integration
  showFilters = false,
  onFiltersClick,
  filtersActive = false,
  
  // Categories for grouped suggestions
  categories = [],
  
  // Loading state
  loading = false,
  
  // Callbacks
  onSuggestionSelect,
  onRecentSearchSelect,
  onClear,
  
  // Additional props
  ...props
}) => {
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const debouncedValue = useDebounce(inputValue, debounceMs);

  // Update parent when debounced value changes
  React.useEffect(() => {
    if (debouncedValue !== value) {
      onChange?.(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  // Update local state when prop changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);
  };

  const handleClear = () => {
    setInputValue('');
    onChange?.('');
    onClear?.();
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      onSearch?.(inputValue.trim());
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.label || suggestion);
    onChange?.(suggestion.value || suggestion);
    onSuggestionSelect?.(suggestion);
    setFocused(false);
  };

  const handleRecentSearchClick = (recentSearch) => {
    setInputValue(recentSearch);
    onChange?.(recentSearch);
    onRecentSearchSelect?.(recentSearch);
    setFocused(false);
  };

  // Show dropdown when focused and there are suggestions or recent searches
  const showDropdown = focused && (
    (showSuggestions && suggestions.length > 0) ||
    (showRecentSearches && recentSearches.length > 0 && !inputValue)
  );

  return (
    <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
      <TextField
        {...props}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)} // Delay to allow clicks
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        fullWidth={fullWidth}
        size={size}
        variant={variant}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {clearable && inputValue && (
                  <IconButton size="small" onClick={handleClear}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )}
                {showFilters && (
                  <IconButton 
                    size="small" 
                    onClick={onFiltersClick}
                    color={filtersActive ? 'primary' : 'default'}
                  >
                    <TuneIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.primary.main,
              },
            },
          },
        }}
      />

      {/* Dropdown with suggestions and recent searches */}
      {showDropdown && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: theme.zIndex.modal,
            maxHeight: 300,
            overflow: 'auto',
            mt: 0.5,
            boxShadow: theme.shadows[8],
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          {/* Recent Searches */}
          {showRecentSearches && recentSearches.length > 0 && !inputValue && (
            <Box sx={{ p: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ px: 1, py: 0.5, display: 'block', fontWeight: 600 }}
              >
                Recent Searches
              </Typography>
              {recentSearches.slice(0, 5).map((search, index) => (
                <Box
                  key={index}
                  sx={{
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                  onClick={() => handleRecentSearchClick(search)}
                >
                  <SearchIcon fontSize="small" color="action" />
                  <Typography variant="body2">{search}</Typography>
                </Box>
              ))}
              {suggestions.length > 0 && <Divider sx={{ my: 1 }} />}
            </Box>
          )}

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <Box sx={{ p: 1 }}>
              {!inputValue && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 1, py: 0.5, display: 'block', fontWeight: 600 }}
                >
                  Suggestions
                </Typography>
              )}
              
              {categories.length > 0 ? (
                // Grouped suggestions by category
                categories.map((category, categoryIndex) => {
                  const categorySuggestions = suggestions.filter(
                    s => s.category === category.value
                  );
                  
                  if (categorySuggestions.length === 0) return null;
                  
                  return (
                    <Box key={category.value}>
                      {categoryIndex > 0 && <Divider sx={{ my: 1 }} />}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ px: 1, py: 0.5, display: 'block', fontWeight: 600 }}
                      >
                        {category.label}
                      </Typography>
                      {categorySuggestions.map((suggestion, index) => (
                        <SuggestionItem
                          key={`${category.value}-${index}`}
                          suggestion={suggestion}
                          onClick={() => handleSuggestionClick(suggestion)}
                          searchTerm={inputValue}
                        />
                      ))}
                    </Box>
                  );
                })
              ) : (
                // Ungrouped suggestions
                suggestions.slice(0, 10).map((suggestion, index) => (
                  <SuggestionItem
                    key={index}
                    suggestion={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    searchTerm={inputValue}
                  />
                ))
              )}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

// Helper component for suggestion items
const SuggestionItem = ({ suggestion, onClick, searchTerm }) => {
  const theme = useTheme();
  const label = suggestion.label || suggestion;
  const description = suggestion.description;
  const icon = suggestion.icon;

  // Highlight matching text
  const highlightText = (text, highlight) => {
    if (!highlight) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlight.toLowerCase() ? (
        <Box
          key={index}
          component="span"
          sx={{ backgroundColor: theme.palette.warning.light, fontWeight: 600 }}
        >
          {part}
        </Box>
      ) : part
    );
  };

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      }}
      onClick={onClick}
    >
      {icon && <Box sx={{ color: 'action.active' }}>{icon}</Box>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {highlightText(label, searchTerm)}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default SearchField;
