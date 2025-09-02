import React, { useState, useEffect } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { invalidateMachineQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';

export default function EditMachine() {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modelId } = useParams();
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

  // Fetch machine model data
  const { data: machineModelResponse, isLoading: modelLoading, error: modelError } = useQuery({
    queryKey: ['machine-model', modelId],
    queryFn: async () => {
      const response = await api.get(`/machines/models/${modelId}`);
      return response.data.data;
    },
    enabled: !!modelId,
  });

  // Extract the actual machine model data from the response
  const machineModel = machineModelResponse?.model;

  // Fetch machine categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: async () => {
      const response = await api.get('/machines/categories');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update form data when machine model is loaded
  useEffect(() => {
    if (machineModel) {
      setFormData({
        name: machineModel.name || '',
        catalogue_number: machineModel.catalogue_number || '',
        manufacturer: machineModel.manufacturer || '',
        description: machineModel.description || '',
        category_id: machineModel.category_id || '',
        warranty_months: machineModel.warranty_months || 12
      });
    }
  }, [machineModel]);

  // Update machine model mutation
  const updateModel = useMutation({
    mutationFn: (data) => api.put(`/machines/models/${modelId}`, data),
    onSuccess: async () => {
      // Invalidate and refetch machine queries
      await invalidateMachineQueries(queryClient);
      
      // Also invalidate dashboard since machine updates affect stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.machineModelUpdated'));
      navigate('/machines');
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || translate('errors.failedToUpdateMachineModel');
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
      newErrors.name = translate('errors.nameRequired');
    }
    
    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = translate('errors.manufacturerRequired');
    }
    
    if (!formData.category_id) {
      newErrors.category_id = translate('errors.categoryRequired');
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Submit the form
    updateModel.mutate(formData);
  };

  const handleCancel = () => {
    navigate('/machines');
  };

  // Loading state
  if (modelLoading || categoriesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (modelError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {modelError.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          {translate('actions.back')}
        </Button>
        <Typography variant="h4" component="h1">
          {translate('actions.editMachineModel')}
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Model Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.modelName')}
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
                label={translate('forms.catalogueNumber')}
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
                label={translate('forms.manufacturer')}
                value={formData.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                error={!!errors.manufacturer}
                helperText={errors.manufacturer}
                required
              />
            </Grid>

            {/* Category */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.category_id} size="small">
                <InputLabel>{translate('forms.category')}</InputLabel>
                <Select
                  value={formData.category_id || ''}
                  onChange={(e) => handleChange('category_id', e.target.value)}
                  label={translate('forms.category')}
                  size="small"
                  displayEmpty
                >
                  <MenuItem value="">
                    {translate('common.selectCategory')}
                  </MenuItem>
                  {categories?.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.category_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {errors.category_id}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            {/* Warranty Period */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.warrantyPeriod')}
                type="number"
                value={formData.warranty_months}
                onChange={(e) => handleChange('warranty_months', parseInt(e.target.value) || 0)}
                inputProps={{ min: 0, max: 120 }}
                error={!!errors.warranty_months}
                helperText={errors.warranty_months || translate('forms.warrantyPeriodHelp')}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('forms.description')}
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
              disabled={updateModel.isPending}
            >
              {translate('actions.cancel')}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={updateModel.isPending}
            >
              {updateModel.isPending ? translate('common.saving') : translate('actions.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
