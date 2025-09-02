import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Simplified hook for unified form operations
 */
export const useUnifiedForm = ({
  config,
  mode = 'create',
  id,
  onSuccess,
  onError,
  beforeSubmit,
  afterSubmit
}) => {
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch existing data for edit mode
  const { data: existingData, isLoading: isLoadingData } = useQuery({
    queryKey: [config.apiEndpoint, id],
    queryFn: async () => {
      if (mode === 'edit' && id) {
        const response = await api.get(`${config.apiEndpoint}/${id}`);
        return response.data.data || response.data;
      }
      return null;
    },
    enabled: mode === 'edit' && !!id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Initialize form data
  useEffect(() => {
    if (existingData && mode === 'edit') {
      setFormData(existingData);
    } else {
      // Set default values for create mode
      const defaultValues = {};
      config.fields.forEach(field => {
        if (field.default !== undefined) {
          defaultValues[field.name] = field.default;
        }
      });
      setFormData(defaultValues);
    }
  }, [existingData, mode, config.fields]);
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(config.apiEndpoint, data);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: [config.apiEndpoint] });
      
      toast.success(translate('notifications.ticketCreatedSuccessfully'));
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      handleError(error);
    }
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.put(`${config.apiEndpoint}/${id}`, data);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: [config.apiEndpoint] });
      
      toast.success(translate('notifications.ticketUpdatedSuccessfully'));
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      handleError(error);
    }
  });
  
  // Error handler
  const handleError = (error) => {
    console.error('Form error:', error);
    
    const errorMessage = error.response?.data?.message || translate('errors.generalError');
    toast.error(errorMessage);
    
    if (onError) {
      onError(error);
    }
  };
  
  // Form submission handler
  const handleSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      // Pre-submit processing
      let processedData = data;
      if (beforeSubmit) {
        processedData = await beforeSubmit(data);
      }
      
      // Submit data
      if (mode === 'create') {
        await createMutation.mutateAsync(processedData);
      } else {
        await updateMutation.mutateAsync(processedData);
      }
      
      // Post-submit processing
      if (afterSubmit) {
        await afterSubmit(processedData);
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Form change handler
  const handleChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };
  
  // Form reset handler
  const handleReset = () => {
    if (existingData && mode === 'edit') {
      setFormData(existingData);
    } else {
      const defaultValues = {};
      config.fields.forEach(field => {
        if (field.default !== undefined) {
          defaultValues[field.name] = field.default;
        }
      });
      setFormData(defaultValues);
    }
    setErrors({});
  };
  
  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isLoading: isLoadingData,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    handleSubmit,
    handleChange,
    handleReset
  };
};

export default useUnifiedForm;
