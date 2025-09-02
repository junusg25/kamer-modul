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
  Stepper,
  Step,
  StepLabel,
  Divider,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function AssignMachine() {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modelId } = useParams();
  const queryClient = useQueryClient();

  // State
  const [activeStep, setActiveStep] = useState(0);
  const [customerType, setCustomerType] = useState('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [description, setDescription] = useState('');

  // New customer form state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    contact_person: ''
  });

  // Fetch model details
  const { data: model, isLoading: modelLoading, error: modelError } = useQuery({
    queryKey: ['machine-model', modelId],
    queryFn: async () => {
      const response = await api.get(`/machines/models/${modelId}`);
      return response.data;
    },
    enabled: !!modelId,
  });

  // Fetch customers
  const { data: customers, isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      return response.data;
    },
  });

  // Create customer mutation
  const createCustomer = useMutation({
    mutationFn: (customerData) => api.post('/customers', customerData),
    onSuccess: (data) => {
      setSelectedCustomerId(data.data.id);
      setCustomerType('existing');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(translate('notifications.customerCreated'));
      setActiveStep(1);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToCreateCustomer'));
    },
  });

  // Assign machine mutation
  const assignMachine = useMutation({
    mutationFn: (assignmentData) => api.post('/machines/assign', assignmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-models'] });
      queryClient.invalidateQueries({ queryKey: ['machine-model', modelId] });
      toast.success(translate('notifications.machineAssigned'));
      navigate(`/machines/model/${modelId}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToAssignMachine'));
    },
  });

  // Handlers
  const handleNext = () => {
    if (activeStep === 0) {
      if (customerType === 'new') {
        // Validate new customer form
        if (!newCustomer.name || !newCustomer.email) {
          toast.error(translate('errors.pleaseFillRequiredFields'));
          return;
        }
        createCustomer.mutate(newCustomer);
      } else {
        // Validate existing customer selection
        if (!selectedCustomerId) {
          toast.error(translate('errors.pleaseSelectCustomer'));
          return;
        }
        setActiveStep(1);
      }
    } else if (activeStep === 1) {
      // Validate machine assignment
      if (!newSerialNumber.trim()) {
        toast.error(translate('errors.pleaseEnterSerialNumber'));
        return;
      }
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (activeStep === 1) {
      setActiveStep(0);
    } else {
      navigate(`/machines/model/${modelId}`);
    }
  };

  const handleSubmit = () => {
    const formData = {
      model_id: parseInt(modelId),
      serial_number: newSerialNumber.trim(),
      customer_id: parseInt(selectedCustomerId),
      purchase_date: purchaseDate || null,
      description: description || null
    };

    assignMachine.mutate(formData);
  };

  const handleNewCustomerChange = (field, value) => {
    setNewCustomer(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerTypeChange = (event) => {
    setCustomerType(event.target.value);
    setSelectedCustomerId('');
    setNewCustomer({
      name: '',
      email: '',
      phone: '',
      address: '',
      company: '',
      contact_person: ''
    });
  };

  // Loading state
  if (modelLoading || customersLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (modelError || customersError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {modelError?.message || customersError?.message}
        </Alert>
      </Box>
    );
  }

  const steps = [
    translate('steps.customerSelection'),
    translate('steps.machineAssignment')
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          {translate('actions.backToMachines')}
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {translate('actions.assignMachine')} - {model?.name || 'Loading...'}
            {model?.catalogue_number && ` (${model.catalogue_number})`}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {translate('actions.assignMachine')}
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: Customer Selection */}
      {activeStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon />
              {translate('steps.customerSelection')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>{translate('common.customerType')}</InputLabel>
                  <Select
                    value={customerType}
                    onChange={handleCustomerTypeChange}
                    label={translate('common.customerType')}
                  >
                    <MenuItem value="existing">{translate('common.existingCustomer')}</MenuItem>
                    <MenuItem value="new">{translate('common.newCustomer')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {customerType === 'existing' ? (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{translate('common.selectCustomer')}</InputLabel>
                    <Select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      label={translate('common.selectCustomer')}
                    >
                      {customers?.data?.map((customer) => (
                        <MenuItem key={customer.id} value={customer.id}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {customer.name}
                            </Typography>
                            {customer.company && (
                              <Typography variant="caption" color="text.secondary">
                                {customer.company}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={translate('forms.name')}
                      value={newCustomer.name}
                      onChange={(e) => handleNewCustomerChange('name', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={translate('forms.email')}
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => handleNewCustomerChange('email', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={translate('forms.phone')}
                      value={newCustomer.phone}
                      onChange={(e) => handleNewCustomerChange('phone', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={translate('forms.company')}
                      value={newCustomer.company}
                      onChange={(e) => handleNewCustomerChange('company', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={translate('forms.address')}
                      value={newCustomer.address}
                      onChange={(e) => handleNewCustomerChange('address', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={translate('forms.contactPerson')}
                      value={newCustomer.contact_person}
                      onChange={(e) => handleNewCustomerChange('contact_person', e.target.value)}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Machine Assignment */}
      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              {translate('steps.machineAssignment')}
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={translate('common.serialNumber')}
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  placeholder={translate('forms.enterSerialNumber')}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={translate('forms.purchaseDate')}
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={translate('forms.description')}
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={translate('forms.descriptionPlaceholder')}
                />
              </Grid>
            </Grid>

            {/* Summary */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              {translate('common.assignmentSummary')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2">
                <strong>{translate('common.customer')}:</strong> {
                  customerType === 'existing' 
                    ? customers?.data?.find(c => c.id === selectedCustomerId)?.name
                    : newCustomer.name
                }
              </Typography>
              <Typography variant="body2">
                <strong>{translate('common.serialNumber')}:</strong> {newSerialNumber}
              </Typography>
              <Typography variant="body2">
                <strong>{translate('common.model')}:</strong> {model?.name} - {model?.catalogue_number}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={createCustomer.isLoading || assignMachine.isLoading}
        >
          {activeStep === 0 ? translate('actions.backToMachines') : translate('actions.back')}
        </Button>
        
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={createCustomer.isLoading || assignMachine.isLoading}
          endIcon={createCustomer.isLoading || assignMachine.isLoading ? <CircularProgress size={20} /> : null}
        >
          {activeStep === 0 
            ? (customerType === 'new' ? translate('actions.createCustomer') : translate('actions.next'))
            : translate('actions.assignMachine')
          }
        </Button>
      </Box>
    </Box>
  );
}
