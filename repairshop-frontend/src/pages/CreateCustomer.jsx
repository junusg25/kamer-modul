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
  CardContent
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { invalidateCustomerQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';
import toast from 'react-hot-toast';

const CreateCustomer = () => {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    translate('forms.basicInformation'),
    translate('forms.contactInformation'),
    translate('forms.addressInformation')
  ];
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    phone2: '',
    fax: '',
    company_name: '',
    vat_number: '',
    city: '',
    postal_code: '',
    street_address: '',
  });

  const [errors, setErrors] = useState({});

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch customer queries using the utility
      await invalidateCustomerQueries(queryClient);
      
      // Also invalidate dashboard since customer creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.customerCreated'));
      navigate('/customers');
    },
    onError: (error) => {
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
      toast.error(translate('errors.failedToCreateCustomer'));
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      phone2: '',
      fax: '',
      company_name: '',
      vat_number: '',
      city: '',
      postal_code: '',
      street_address: '',
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
    if (!formData.phone) newErrors.phone = translate('errors.phoneRequired');

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
            label={translate('forms.companyName')}
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.vatNumber')}
            value={formData.vat_number}
            onChange={(e) => handleChange('vat_number', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderContactStep = () => (
    <Box>
      <Grid container spacing={3}>
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
            error={!!errors.phone}
            helperText={errors.phone}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.phone2')}
            value={formData.phone2}
            onChange={(e) => handleChange('phone2', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.fax')}
            value={formData.fax}
            onChange={(e) => handleChange('fax', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderAddressStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={translate('forms.streetAddress')}
            value={formData.street_address}
            onChange={(e) => handleChange('street_address', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.city')}
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.postalCode')}
            value={formData.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderContactStep();
      case 2:
        return renderAddressStep();
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
          onClick={() => navigate('/customers')}
          sx={{ mr: 2 }}
        >
          {translate('actions.backToCustomers')}
        </Button>
        <PersonIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {translate('actions.createNewCustomer')}
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
              onClick={() => navigate('/customers')}
              sx={{ mr: 1 }}
            >
              {translate('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={createMutation.isLoading}
            >
              {activeStep === steps.length - 1 ? translate('actions.createCustomer') : translate('actions.next')}
              {createMutation.isLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateCustomer;
