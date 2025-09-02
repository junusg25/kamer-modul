import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { invalidateMachineQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';

export default function CreateMachine() {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [formData, setFormData] = useState({
    name: '',
    catalogue_number: '',
    manufacturer: '',
    description: '',
    category_id: '',
    warranty_months: 12
  });

  const [errors, setErrors] = useState({});

  // Fetch machine categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: async () => {
      const response = await api.get('/machines/categories');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create machine model mutation
  const createModel = useMutation({
    mutationFn: (data) => api.post('/machines/models', data),
    onSuccess: async () => {
      // Invalidate and refetch machine queries
      await invalidateMachineQueries(queryClient);
      
      // Also invalidate dashboard since machine creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.machineModelCreated'));
      navigate('/machines');
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || translate('errors.failedToCreateMachineModel');
      toast.error(errorMessage);
      
      // Handle validation errors
      if (error.response?.data?.errors) {
        const validationErrors = {};
        error.response.data.errors.forEach(err => {
          validationErrors[err.field] = err.message;
        });
        setErrors(validationErrors);
      }
    },
  });

  // Handlers
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = () => {
    // Validate required fields
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = translate('errors.modelNameRequired');
    }
    
    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = translate('errors.manufacturerRequired');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit form
    createModel.mutate(formData);
  };

  const handleCancel = () => {
    navigate('/machines');
  };

  if (categoriesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          {translate('navigation.back')}
        </Button>
        <Typography variant="h4" component="h1">
          {translate('actions.createMachineModel')}
        </Typography>
      </Box>

      {/* Form */}
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Model Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('tableHeaders.modelName')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>

            {/* Catalogue Number */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('tableHeaders.catalogueNumber')}
                value={formData.catalogue_number}
                onChange={(e) => handleChange('catalogue_number', e.target.value)}
                error={!!errors.catalogue_number}
                helperText={errors.catalogue_number}
              />
            </Grid>

            {/* Manufacturer */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('tableHeaders.manufacturer')}
                value={formData.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                error={!!errors.manufacturer}
                helperText={errors.manufacturer}
                required
              />
            </Grid>

            {/* Category */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{translate('tableHeaders.category')}</InputLabel>
                <Select
                  value={formData.category_id}
                  onChange={(e) => handleChange('category_id', e.target.value)}
                  label={translate('tableHeaders.category')}
                >
                  <MenuItem value="">
                    <em>{translate('common.selectCategory')}</em>
                  </MenuItem>
                  {categories?.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('tableHeaders.description')}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={4}
                error={!!errors.description}
                helperText={errors.description}
              />
            </Grid>

            {/* Warranty Period */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label={translate('tableHeaders.warrantyPeriod')}
                value={formData.warranty_months}
                onChange={(e) => handleChange('warranty_months', parseInt(e.target.value) || 12)}
                error={!!errors.warranty_months}
                helperText={errors.warranty_months || translate('common.warrantyPeriodHelp')}
                inputProps={{ min: 1, max: 120 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Action Buttons */}
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={handleCancel}
              disabled={createModel.isPending}
            >
              {translate('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              startIcon={createModel.isPending ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={createModel.isPending}
            >
              {createModel.isPending ? translate('actions.creating') : translate('actions.create')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
