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
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  AttachMoney as MoneyIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { invalidateInventoryQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';
import toast from 'react-hot-toast';

const CreateInventoryItem = () => {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    translate('forms.basicInformation'),
    translate('forms.pricingInformation'),
    translate('forms.stockInformation')
  ];
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: '',
    unit_price: '',
    min_stock_level: '',
    supplier: '',
    sku: '',
    location: '',
  });

  const [errors, setErrors] = useState({});

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/inventory', data);
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch inventory queries
      await invalidateInventoryQueries(queryClient);
      
      // Also invalidate dashboard since inventory creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.inventoryItemCreated'));
      navigate('/inventory');
    },
    onError: (error) => {
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
      toast.error(translate('errors.failedToCreateInventoryItem'));
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      quantity: '',
      unit_price: '',
      min_stock_level: '',
      supplier: '',
      sku: '',
      location: '',
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
    if (!formData.quantity) newErrors.quantity = translate('errors.quantityRequired');
    if (!formData.unit_price) newErrors.unit_price = translate('errors.unitPriceRequired');

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
            label={translate('forms.category')}
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.sku')}
            value={formData.sku}
            onChange={(e) => handleChange('sku', e.target.value)}
            placeholder={translate('forms.skuPlaceholder')}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={translate('forms.description')}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            multiline
            rows={3}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderPricingStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.unitPrice')}
            type="number"
            value={formData.unit_price}
            onChange={(e) => handleChange('unit_price', e.target.value)}
            error={!!errors.unit_price}
            helperText={errors.unit_price}
            required
            InputProps={{
              startAdornment: <Typography variant="body2" sx={{ mr: 1 }}>€</Typography>,
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderStockStep = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.quantity')}
            type="number"
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            error={!!errors.quantity}
            helperText={errors.quantity}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.minStockLevel')}
            type="number"
            value={formData.min_stock_level}
            onChange={(e) => handleChange('min_stock_level', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.supplier')}
            value={formData.supplier}
            onChange={(e) => handleChange('supplier', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={translate('forms.location')}
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder={translate('forms.locationPlaceholder')}
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
        return renderPricingStep();
      case 2:
        return renderStockStep();
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
          onClick={() => navigate('/inventory')}
          sx={{ mr: 2 }}
        >
          {translate('actions.backToInventory')}
        </Button>
        <InventoryIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {translate('actions.createNewInventoryItem')}
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
              onClick={() => navigate('/inventory')}
              sx={{ mr: 1 }}
            >
              {translate('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={createMutation.isLoading}
            >
              {activeStep === steps.length - 1 ? translate('actions.createInventoryItem') : translate('actions.next')}
              {createMutation.isLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateInventoryItem;
