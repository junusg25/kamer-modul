import React from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
  Switch,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Box,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Visibility, VisibilityOff, Clear } from '@mui/icons-material';

/**
 * Standardized form field component that handles all input types consistently
 */
const FormField = ({
  // Field configuration
  type = 'text',
  name,
  label,
  value,
  onChange,
  onBlur,
  
  // Validation
  error,
  helperText,
  required = false,
  
  // Field options
  options = [],
  placeholder,
  disabled = false,
  readOnly = false,
  multiline = false,
  rows = 4,
  
  // Styling
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  
  // Special props
  startAdornment,
  endAdornment,
  multiple = false,
  freeSolo = false,
  clearable = false,
  
  // Additional props
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  
  // Handle password visibility toggle
  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  // Handle clear value
  const handleClear = () => {
    onChange({ target: { name, value: multiple ? [] : '' } });
  };

  // Common props for all fields
  const commonProps = {
    name,
    value: value || (multiple ? [] : ''),
    onChange,
    onBlur,
    error: Boolean(error),
    disabled,
    fullWidth,
    size,
    variant,
    required,
    ...props,
  };

  // Render based on field type
  switch (type) {
    case 'text':
    case 'email':
    case 'url':
    case 'tel':
    case 'number':
      return (
        <TextField
          {...commonProps}
          type={type}
          label={label}
          placeholder={placeholder}
          multiline={multiline}
          rows={multiline ? rows : undefined}
          helperText={error || helperText}
          InputProps={{
            startAdornment: startAdornment && (
              <InputAdornment position="start">{startAdornment}</InputAdornment>
            ),
            endAdornment: (
              <>
                {clearable && value && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClear}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )}
                {endAdornment && (
                  <InputAdornment position="end">{endAdornment}</InputAdornment>
                )}
              </>
            ),
            readOnly,
          }}
        />
      );

    case 'password':
      return (
        <TextField
          {...commonProps}
          type={showPassword ? 'text' : 'password'}
          label={label}
          placeholder={placeholder}
          helperText={error || helperText}
          InputProps={{
            startAdornment: startAdornment && (
              <InputAdornment position="start">{startAdornment}</InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleTogglePassword} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
            readOnly,
          }}
        />
      );

    case 'select':
      return (
        <FormControl {...commonProps} error={Boolean(error)}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value || ''}
            onChange={onChange}
            onBlur={onBlur}
            label={label}
            multiple={multiple}
            renderValue={multiple ? (selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((val) => {
                  const option = options.find(opt => opt.value === val);
                  return (
                    <Chip
                      key={val}
                      label={option?.label || val}
                      size="small"
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            ) : undefined}
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {(error || helperText) && (
            <FormHelperText>{error || helperText}</FormHelperText>
          )}
        </FormControl>
      );

    case 'autocomplete':
      return (
        <Autocomplete
          {...commonProps}
          options={options}
          getOptionLabel={(option) => option.label || option}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          multiple={multiple}
          freeSolo={freeSolo}
          clearIcon={clearable ? <Clear /> : null}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              error={Boolean(error)}
              helperText={error || helperText}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    {startAdornment && (
                      <InputAdornment position="start">{startAdornment}</InputAdornment>
                    )}
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.value || option}
                label={option.label || option}
                size="small"
                variant="outlined"
              />
            ))
          }
        />
      );

    case 'date':
      return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label={label}
            value={value || null}
            onChange={(newValue) => {
              onChange({ target: { name, value: newValue } });
            }}
            disabled={disabled}
            renderInput={(params) => (
              <TextField
                {...params}
                {...commonProps}
                helperText={error || helperText}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: startAdornment && (
                    <InputAdornment position="start">{startAdornment}</InputAdornment>
                  ),
                  readOnly,
                }}
              />
            )}
          />
        </LocalizationProvider>
      );

    case 'switch':
      return (
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => onChange({ target: { name, value: e.target.checked } })}
                disabled={disabled}
              />
            }
            label={label}
          />
          {(error || helperText) && (
            <FormHelperText error={Boolean(error)} sx={{ ml: 0 }}>
              {error || helperText}
            </FormHelperText>
          )}
        </Box>
      );

    case 'checkbox':
      return (
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(value)}
                onChange={(e) => onChange({ target: { name, value: e.target.checked } })}
                disabled={disabled}
              />
            }
            label={label}
          />
          {(error || helperText) && (
            <FormHelperText error={Boolean(error)} sx={{ ml: 0 }}>
              {error || helperText}
            </FormHelperText>
          )}
        </Box>
      );

    case 'radio':
      return (
        <FormControl error={Boolean(error)} disabled={disabled}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {label}
          </Typography>
          <RadioGroup
            value={value || ''}
            onChange={onChange}
            row={props.row}
          >
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio />}
                label={option.label}
              />
            ))}
          </RadioGroup>
          {(error || helperText) && (
            <FormHelperText>{error || helperText}</FormHelperText>
          )}
        </FormControl>
      );

    default:
      return (
        <TextField
          {...commonProps}
          type={type}
          label={label}
          placeholder={placeholder}
          helperText={error || helperText}
        />
      );
  }
};

export default FormField;
