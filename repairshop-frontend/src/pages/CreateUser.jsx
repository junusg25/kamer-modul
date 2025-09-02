import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Paper,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { invalidateUserQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';
import toast from 'react-hot-toast';

const CreateUser = () => {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    translate('forms.basicInformation'),
    translate('forms.accountInformation'),
    translate('forms.roleAssignment')
  ];
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
    phone: '',
    department: '',
  });

  const [errors, setErrors] = useState({});

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/users', data);
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch user queries
      await invalidateUserQueries(queryClient);
      
      // Also invalidate dashboard since user creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.userCreated'));
      navigate('/users');
    },
    onError: (error) => {
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
      toast.error(translate('errors.failedToCreateUser'));
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'technician',
      phone: '',
      department: '',
    });
    setErrors({});
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = () => {
    // Validation
    const newErrors = {};
    if (!formData.name) newErrors.name = translate('errors.nameRequired');
    if (!formData.email) newErrors.email = translate('errors.emailRequired');
    if (!formData.password) newErrors.password = translate('errors.passwordRequired');
    if (formData.password && formData.password.length < 6) {
      newErrors.password = translate('errors.passwordMinLength');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderBasicInfoStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.name')}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.email')}
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.phone')}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.department')}
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderAccountStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.password')}
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            required
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderRoleStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{translate('tableHeaders.role')}</InputLabel>
            <Select
              value={formData.role}
              label={translate('tableHeaders.role')}
              onChange={(e) => handleChange('role', e.target.value)}
            >
              <MenuItem value="admin">{translate('roles.admin')}</MenuItem>
              <MenuItem value="manager">{translate('roles.manager')}</MenuItem>
              <MenuItem value="technician">{translate('roles.technician')}</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderAccountStep();
      case 2:
        return renderRoleStep();
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/users')}
          sx={{ mr: 2 }}
        >
          {translate('actions.backToUsers')}
        </Button>
        <PersonIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {translate('actions.createNewUser')}
        </Typography>
      </Box>

      {errors.general && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errors.general}
        </Alert>
      )}

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <Card>
          <CardContent>
            {getStepContent(activeStep)}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            {translate('actions.back')}
          </Button>
          <Box>
            <Button
              variant="outlined"
              onClick={() => navigate('/users')}
              sx={{ mr: 1 }}
            >
              {translate('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={createMutation.isLoading}
            >
              {activeStep === steps.length - 1 ? translate('actions.createUser') : translate('actions.next')}
              {createMutation.isLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateUser;
