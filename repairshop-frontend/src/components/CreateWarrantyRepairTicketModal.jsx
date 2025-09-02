import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Chip,
  FormControlLabel,
  Switch,
  Autocomplete
} from '@mui/material';
import {
  ConfirmationNumber as TicketIcon,
  Build as BuildIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { de } from 'date-fns/locale';

const CreateWarrantyRepairTicketModal = ({ open, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { formatDateForInput, translate: t } = useLanguage();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    // Customer fields
    customer_type: 'existing', // 'existing' or 'new'
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_phone2: '',
    customer_fax: '',
    customer_company_name: '',
    customer_vat_number: '',
    customer_city: '',
    customer_postal_code: '',
    customer_street_address: '',
    
    // Machine fields
    machine_type: 'existing', // 'existing' or 'new'
    machine_id: '',
    machine_model_type: 'existing', // 'existing' or 'new' - for new machines
    machine_manufacturer: '',
    machine_model_name: '', // existing model name or new model name
    machine_catalogue_number: '', // catalogue number for new model
    machine_serial_number: '',
    machine_description: '',
    machine_category_id: '',
    machine_bought_at: '',
    machine_receipt_number: '',
    machine_purchase_date: '',
    
    // Ticket fields
    problem_description: '',
    notes: '',
    additional_equipment: '',
    brought_by: '',
  });

  const [errors, setErrors] = useState({});

  // Fetch customers
  const { data: customersData, isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      return response.data?.data || [];
    }
  });

  // Fetch machine models (grouped by name/catalogue_number)
  const { data: machineModelsData, isLoading: machineModelsLoading, error: machineModelsError } = useQuery({
    queryKey: ['machineModels'],
    queryFn: async () => {
      const response = await api.get('/machines/models');
      return response.data?.data || [];
    }
  });

  // Fetch machine categories
  const { data: machineCategoriesData } = useQuery({
    queryKey: ['machineCategories'],
    queryFn: async () => {
      const response = await api.get('/machine-categories');
      return response.data?.data || [];
    }
  });

  // Fetch machines for selected customer
  const { data: customerMachinesData, isLoading: customerMachinesLoading, error: customerMachinesError } = useQuery({
    queryKey: ['customer-machines', formData.customer_id],
    queryFn: async () => {
      if (!formData.customer_id) return [];
      const response = await api.get(`/machines/by-customer/${formData.customer_id}`);
      return response.data?.data || [];
    },
    enabled: formData.customer_type === 'existing' && !!formData.customer_id
  });

  // Fetch unique manufacturers
  const { data: manufacturersData, isLoading: manufacturersLoading } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.get('/machines/manufacturers');
      return response.data?.data || [];
    }
  });

  // Fetch unique bought_at locations
  const { data: boughtAtLocationsData, isLoading: boughtAtLocationsLoading } = useQuery({
    queryKey: ['bought-at-locations'],
    queryFn: async () => {
      const response = await api.get('/machines/bought-at-locations');
      return response.data?.data || [];
    }
  });



  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/warrantyRepairTickets', data);
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate all warranty repair tickets queries (including those with query parameters)
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
      });
      
      // Force refetch to ensure immediate update
      await queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
      });
      
      onSuccess();
      resetForm();
    },
    onError: (error) => {
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
    }
  });

  const resetForm = () => {
    setFormData({
      customer_type: 'existing',
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_phone2: '',
      customer_fax: '',
      customer_company_name: '',
      customer_vat_number: '',
      customer_city: '',
      customer_postal_code: '',
      customer_street_address: '',
      machine_type: 'existing',
      machine_id: '',
      machine_model_type: 'existing',
      machine_manufacturer: '',
      machine_model_name: '',
      machine_catalogue_number: '',
      machine_serial_number: '',
      machine_description: '',
      machine_category_id: '',
      machine_bought_at: '',
      machine_receipt_number: '',
      machine_purchase_date: '',
      problem_description: '',
      notes: '',
      additional_equipment: '',
      brought_by: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    
    // Required ticket field
    if (!formData.problem_description) newErrors.problem_description = t('forms.problemDescriptionRequired');

    // Customer validation
    if (formData.customer_type === 'new') {
      if (!formData.customer_name) newErrors.customer_name = t('forms.customerNameRequired');
      if (!formData.customer_email) newErrors.customer_email = t('forms.customerEmailRequired');
    } else if (formData.customer_type === 'existing') {
      if (!formData.customer_id) newErrors.customer_id = t('forms.pleaseSelectCustomer');
    }

    // Machine validation
    if (formData.machine_type === 'new' || formData.customer_type === 'new') {
      if (!formData.machine_serial_number) newErrors.machine_serial_number = t('forms.serialNumberRequired');
      
      if (formData.machine_model_type === 'existing') {
        if (!formData.machine_model_name) newErrors.machine_model_name = t('forms.pleaseSelectMachineModel');
      } else if (formData.machine_model_type === 'new') {
        if (!formData.machine_manufacturer) newErrors.machine_manufacturer = t('forms.manufacturerRequired');
        if (!formData.machine_model_name) newErrors.machine_model_name = t('forms.modelNameRequired');
        if (!formData.machine_catalogue_number) newErrors.machine_catalogue_number = t('forms.catalogueNumberRequired');
        if (!formData.machine_category_id) newErrors.machine_category_id = t('forms.categoryRequired');
      }
    } else if (formData.machine_type === 'existing') {
      if (!formData.machine_id) newErrors.machine_id = t('forms.pleaseSelectMachine');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare the ticket data based on form selections
    const ticketData = {
      problem_description: formData.problem_description,
      notes: formData.notes,
      additional_equipment: formData.additional_equipment,
      brought_by: formData.brought_by,
      submitted_by: user?.id,
    }

    // Handle customer data
    if (formData.customer_type === 'existing') {
      ticketData.customer_id = formData.customer_id
    } else {
      // For new customer, include all customer details
      ticketData.customer_name = formData.customer_name
      ticketData.customer_email = formData.customer_email
      ticketData.customer_phone = formData.customer_phone
      ticketData.customer_phone2 = formData.customer_phone2
      ticketData.customer_fax = formData.customer_fax
      ticketData.customer_company_name = formData.customer_company_name
      ticketData.customer_vat_number = formData.customer_vat_number
      ticketData.customer_city = formData.customer_city
      ticketData.customer_postal_code = formData.customer_postal_code
      ticketData.customer_street_address = formData.customer_street_address
    }

    // Handle machine data
    if (formData.customer_type === 'existing' && formData.machine_type === 'existing') {
      // Existing customer, existing machine
      ticketData.machine_id = formData.machine_id
    } else {
      // New machine (either for existing customer or new customer)
      ticketData.machine_manufacturer = formData.machine_manufacturer
      ticketData.machine_model_type = formData.machine_model_type
      ticketData.machine_model_name = formData.machine_model_name
      ticketData.machine_catalogue_number = formData.machine_catalogue_number
      ticketData.machine_serial_number = formData.machine_serial_number
      ticketData.machine_description = formData.machine_description
      ticketData.machine_category_id = formData.machine_category_id
      ticketData.machine_bought_at = formData.machine_bought_at
      ticketData.machine_receipt_number = formData.machine_receipt_number
      ticketData.machine_purchase_date = formData.machine_purchase_date
    }

    createMutation.mutate(ticketData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TicketIcon color="primary" />
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {t('forms.createWarrantyRepairTicket')}
          </Typography>
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {errors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Step 1: Customer Selection */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: '50%', 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}>
                  1
                </Box>
                {t('forms.customerInformation')}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                  variant={formData.customer_type === 'existing' ? 'contained' : 'outlined'}
                  onClick={() => setFormData({ 
                    ...formData, 
                    customer_type: 'existing',
                    customer_id: '',
                    customer_name: '',
                    customer_email: '',
                    customer_phone: '',
                    customer_phone2: '',
                    customer_fax: '',
                    customer_company_name: '',
                    customer_vat_number: '',
                    customer_city: '',
                    customer_postal_code: '',
                    customer_street_address: '',
                    machine_id: '',
                    machine_model_type: 'existing',
                    machine_manufacturer: '',
                    machine_model_name: '',
                    machine_catalogue_number: '',
                    machine_serial_number: '',
                    machine_description: '',
                    machine_category_id: '',
                    machine_bought_at: '',
                    machine_receipt_number: '',
                    machine_purchase_date: ''
                  })}
                  sx={{ minWidth: 140 }}
                >
                  {t('forms.existingCustomer')}
                </Button>
                <Button
                  variant={formData.customer_type === 'new' ? 'contained' : 'outlined'}
                  onClick={() => setFormData({ 
                    ...formData, 
                    customer_type: 'new',
                    customer_id: '',
                    customer_name: '',
                    customer_email: '',
                    customer_phone: '',
                    customer_phone2: '',
                    customer_fax: '',
                    customer_company_name: '',
                    customer_vat_number: '',
                    customer_city: '',
                    customer_postal_code: '',
                    customer_street_address: '',
                    machine_id: '',
                    machine_model_type: 'existing',
                    machine_manufacturer: '',
                    machine_model_name: '',
                    machine_catalogue_number: '',
                    machine_serial_number: '',
                    machine_description: '',
                    machine_category_id: '',
                    machine_bought_at: '',
                    machine_receipt_number: '',
                    machine_purchase_date: ''
                  })}
                  sx={{ minWidth: 140 }}
                >
                  {t('forms.newCustomer')}
                </Button>
              </Box>
              
                                                           {formData.customer_type === 'existing' ? (
                  <>
                    <FormControl fullWidth error={!!errors.customer_id}>
                                            <InputLabel>{t('forms.selectCustomer')}</InputLabel>
                       <Select
                         value={formData.customer_id}
                         label={t('forms.selectCustomer')}
                       onChange={(e) => handleChange('customer_id', e.target.value ? Number(e.target.value) : '')}
                       required
                     >
                       {customersLoading ? (
                         <MenuItem disabled>Loading customers...</MenuItem>
                       ) : customersError ? (
                         <MenuItem disabled>Error loading customers</MenuItem>
                       ) : (customersData || []).length === 0 ? (
                         <MenuItem disabled>No customers available</MenuItem>
                       ) : (
                         (customersData || []).map((customer) => (
                           <MenuItem key={customer.id} value={customer.id}>
                             <Box>
                               <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                 {customer.name}
                               </Typography>
                               <Typography variant="caption" color="text.secondary">
                                 {customer.email} {customer.phone && `• ${customer.phone}`}
                               </Typography>
                             </Box>
                           </MenuItem>
                         ))
                       )}
                     </Select>
                     {errors.customer_id && (
                       <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                         {errors.customer_id}
                       </Typography>
                     )}
                   </FormControl>
                 </>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.customerName')}
                      value={formData.customer_name}
                      onChange={(e) => handleChange('customer_name', e.target.value)}
                      required
                      error={!!errors.customer_name}
                      helperText={errors.customer_name}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.companyName')}
                      value={formData.customer_company_name}
                      onChange={(e) => handleChange('customer_company_name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.vatNumber')}
                      value={formData.customer_vat_number}
                      onChange={(e) => handleChange('customer_vat_number', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.email')}
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => handleChange('customer_email', e.target.value)}
                      required
                      error={!!errors.customer_email}
                      helperText={errors.customer_email}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.phone')}
                      value={formData.customer_phone}
                      onChange={(e) => handleChange('customer_phone', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.phone2')}
                      value={formData.customer_phone2}
                      onChange={(e) => handleChange('customer_phone2', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.fax')}
                      value={formData.customer_fax}
                      onChange={(e) => handleChange('customer_fax', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.city')}
                      value={formData.customer_city}
                      onChange={(e) => handleChange('customer_city', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('forms.postalCode')}
                      value={formData.customer_postal_code}
                      onChange={(e) => handleChange('customer_postal_code', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={t('forms.streetAddress')}
                      multiline
                      rows={2}
                      value={formData.customer_street_address}
                      onChange={(e) => handleChange('customer_street_address', e.target.value)}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>

            {/* Step 2: Machine Selection - Only show if customer is selected */}
            {((formData.customer_type === 'existing' && formData.customer_id) || formData.customer_type === 'new') && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: '50%', 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}>
                    2
                  </Box>
                  {t('forms.machineInformation')}
                </Typography>
                
                {formData.customer_type === 'existing' && (
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button
                      variant={formData.machine_type === 'existing' ? 'contained' : 'outlined'}
                      onClick={() => setFormData({ 
                        ...formData, 
                        machine_type: 'existing',
                        machine_id: '',
                        machine_model_type: 'existing',
                        machine_manufacturer: '',
                        machine_model_name: '',
                        machine_catalogue_number: '',
                        machine_serial_number: '',
                        machine_description: '',
                        machine_category_id: '',
                        machine_bought_at: '',
                        machine_receipt_number: '',
                        machine_purchase_date: ''
                      })}
                      sx={{ minWidth: 140 }}
                    >
                      {t('forms.existingMachine')}
                    </Button>
                    <Button
                      variant={formData.machine_type === 'new' ? 'contained' : 'outlined'}
                      onClick={() => setFormData({ 
                        ...formData, 
                        machine_type: 'new',
                        machine_id: '',
                        machine_model_type: 'existing',
                        machine_manufacturer: '',
                        machine_model_name: '',
                        machine_catalogue_number: '',
                        machine_serial_number: '',
                        machine_description: '',
                        machine_category_id: '',
                        machine_bought_at: '',
                        machine_receipt_number: '',
                        machine_purchase_date: ''
                      })}
                      sx={{ minWidth: 140 }}
                    >
                      {t('forms.newMachine')}
                    </Button>
                  </Box>
                )}
                
                                 {/* Existing Machine Selection */}
                 {formData.machine_type === 'existing' && formData.customer_type === 'existing' && formData.customer_id ? (
                   <>
                     <FormControl fullWidth error={!!errors.machine_id}>
                       <InputLabel>{t('forms.selectMachine')}</InputLabel>
                       <Select
                         value={formData.machine_id}
                         label={t('forms.selectMachine')}
                         onChange={(e) => handleChange('machine_id', e.target.value ? Number(e.target.value) : '')}
                         required
                       >
                         {customerMachinesLoading ? (
                           <MenuItem disabled>{t('forms.loadingMachines')}</MenuItem>
                         ) : customerMachinesError ? (
                           <MenuItem disabled>{t('forms.errorLoadingMachines')}</MenuItem>
                         ) : (customerMachinesData || []).length === 0 ? (
                           <MenuItem disabled>{t('forms.noMachinesFoundForCustomer')}</MenuItem>
                         ) : (
                           (customerMachinesData || []).map((machine) => (
                             <MenuItem key={machine.id} value={machine.id}>
                               <Box>
                                 <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                   {machine.name}
                                 </Typography>
                                 <Typography variant="caption" color="text.secondary">
                                   {machine.serial_number}
                                 </Typography>
                               </Box>
                             </MenuItem>
                           ))
                         )}
                       </Select>
                       {errors.machine_id && (
                         <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                           {errors.machine_id}
                         </Typography>
                       )}
                     </FormControl>
                   </>
                 ) : null}
                
                                 {/* New Machine Creation */}
                 {formData.machine_type === 'new' || formData.customer_type === 'new' ? (
                   <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                     {/* Machine Model Selection */}
                     <Box>
                       <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
                         Machine Model
                       </Typography>
                       <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                         <Button
                           variant={formData.machine_model_type === 'existing' ? 'contained' : 'outlined'}
                           size="small"
                           onClick={() => setFormData({ 
                             ...formData, 
                             machine_model_type: 'existing',
                             machine_manufacturer: '',
                             machine_model_name: '',
                             machine_catalogue_number: '',
                             machine_description: '',
                             machine_category_id: '',
                             machine_bought_at: '',
                             machine_receipt_number: '',
                             machine_purchase_date: ''
                           })}
                         >
                           Existing Model
                         </Button>
                         <Button
                           variant={formData.machine_model_type === 'new' ? 'contained' : 'outlined'}
                           size="small"
                           onClick={() => setFormData({ 
                             ...formData, 
                             machine_model_type: 'new',
                             machine_manufacturer: '',
                             machine_model_name: '',
                             machine_catalogue_number: '',
                             machine_description: '',
                             machine_category_id: '',
                             machine_bought_at: '',
                             machine_receipt_number: '',
                             machine_purchase_date: ''
                           })}
                         >
                           New Model
                         </Button>
                       </Box>
                      
                                                                                           {formData.machine_model_type === 'existing' ? (
                          <>
                         <FormControl fullWidth>
                                                 <InputLabel>{t('forms.selectMachineModel')}</InputLabel>
                       <Select
                         value={formData.machine_model_name}
                         label={t('forms.selectMachineModel')}
                            onChange={(e) => {
                              const selectedModel = machineModelsData?.find(model => model.name === e.target.value);
                              handleChange('machine_model_name', e.target.value);
                              if (selectedModel) {
                                handleChange('machine_manufacturer', selectedModel.manufacturer);
                              }
                            }}
                            required
                          >
                            {machineModelsLoading ? (
                              <MenuItem disabled>Loading machine models...</MenuItem>
                            ) : machineModelsError ? (
                              <MenuItem disabled>Error loading machine models</MenuItem>
                            ) : (machineModelsData || []).length === 0 ? (
                              <MenuItem disabled>No machine models available</MenuItem>
                            ) : (
                              (machineModelsData || []).map((model) => (
                                <MenuItem key={`${model.name}-${model.catalogue_number || 'no-cat'}`} value={model.name}>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {model.name}
                                    </Typography>
                                    {model.catalogue_number && (
                                      <Typography variant="caption" color="text.secondary">
                                        Cat: {model.catalogue_number}
                                      </Typography>
                                    )}
                                  </Box>
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                         </>
                                             ) : (
                         <Grid container spacing={3}>
                           <Grid item xs={12} sm={6}>
                             <Autocomplete
                               fullWidth
                               options={manufacturersData || []}
                               value={formData.machine_manufacturer}
                               onChange={(event, newValue) => handleChange('machine_manufacturer', newValue || '')}
                               onInputChange={(event, newInputValue) => {
                                 // Allow free text input for new manufacturers
                                 if (newInputValue !== formData.machine_manufacturer) {
                                   handleChange('machine_manufacturer', newInputValue);
                                 }
                               }}
                               freeSolo
                               renderInput={(params) => (
                                 <TextField
                                   {...params}
                                   label="Manufacturer"
                                   placeholder="e.g., Haas, DMG MORI"
                                   required
                                   error={!!errors.machine_manufacturer}
                                   helperText={errors.machine_manufacturer}
                                   size="small"
                                 />
                               )}
                               loading={manufacturersLoading}
                             />
                           </Grid>
                                                     <Grid item xs={12} sm={6}>
                             <TextField
                               fullWidth
                               label="Model Name"
                               placeholder="e.g., HD 8/18"
                               value={formData.machine_model_name}
                               onChange={(e) => handleChange('machine_model_name', e.target.value)}
                               required
                               error={!!errors.machine_model_name}
                               helperText={errors.machine_model_name}
                               size="small"
                             />
                           </Grid>
                           <Grid item xs={12} sm={6}>
                             <TextField
                               fullWidth
                               label="Catalogue Number"
                               placeholder="e.g., 123456789"
                               value={formData.machine_catalogue_number}
                               onChange={(e) => handleChange('machine_catalogue_number', e.target.value)}
                               required
                               error={!!errors.machine_catalogue_number}
                               helperText={errors.machine_catalogue_number}
                               size="small"
                             />
                           </Grid>
                           <Grid item xs={12} sm={6}>
                             <FormControl fullWidth error={!!errors.machine_category_id} size="small">
                               <InputLabel>Category</InputLabel>
                               <Select
                                 value={formData.machine_category_id}
                                 label="Category"
                                 onChange={(e) => handleChange('machine_category_id', e.target.value)}
                                 required
                               >
                                 {(machineCategoriesData || []).map((category) => (
                                   <MenuItem key={category.id} value={category.id}>
                                     {category.name}
                                   </MenuItem>
                                 ))}
                               </Select>
                               {errors.machine_category_id && (
                                 <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                   {errors.machine_category_id}
                                 </Typography>
                               )}
                             </FormControl>
                           </Grid>
                        </Grid>
                      )}
                    </Box>
                    
                                         {/* Machine Details */}
                     <Box sx={{ mt: 3 }}>
                       <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
                         Machine Details
                       </Typography>
                       
                                               <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <TextField
                            fullWidth
                            label="Serial Number"
                            placeholder="e.g., SN123456789"
                            value={formData.machine_serial_number}
                            onChange={(e) => handleChange('machine_serial_number', e.target.value)}
                            required
                            error={!!errors.machine_serial_number}
                            helperText={errors.machine_serial_number}
                            size="small"
                          />
                          <Autocomplete
                            fullWidth
                            options={boughtAtLocationsData || []}
                            value={formData.machine_bought_at}
                            onChange={(event, newValue) => handleChange('machine_bought_at', newValue || '')}
                            onInputChange={(event, newInputValue) => {
                              // Allow free text input for new locations
                              if (newInputValue !== formData.machine_bought_at) {
                                handleChange('machine_bought_at', newInputValue);
                              }
                            }}
                            freeSolo
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Bought At"
                                placeholder="e.g., Local Dealer, Online Store"
                                size="small"
                              />
                            )}
                            loading={boughtAtLocationsLoading}
                          />
                          <TextField
                            fullWidth
                            label="Receipt Number"
                            placeholder="e.g., INV-2024-001"
                            value={formData.machine_receipt_number}
                            onChange={(e) => handleChange('machine_receipt_number', e.target.value)}
                            size="small"
                          />
                          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
                            <DatePicker
                              label="Purchase Date"
                              value={formData.machine_purchase_date ? new Date(formData.machine_purchase_date) : null}
                              onChange={(newValue) => handleChange('machine_purchase_date', newValue ? newValue.toISOString() : '')}
                              slotProps={{
                                textField: {
                                  fullWidth: true,
                                  size: "small",
                                  InputLabelProps: { shrink: true },
                                  InputProps: {
                                    startAdornment: <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                                  }
                                }
                              }}
                              format="dd.MM.yyyy"
                            />
                          </LocalizationProvider>
                        </Box>
                     </Box>
                    
                                         {/* Machine Description - only show for new machine models */}
                     {formData.machine_model_type === 'new' && (
                       <Box sx={{ mt: 3 }}>
                         <TextField
                           fullWidth
                           label="Machine Description"
                           placeholder="Describe the machine model specifications, features, etc."
                           multiline
                           rows={3}
                           value={formData.machine_description}
                           onChange={(e) => handleChange('machine_description', e.target.value)}
                           size="small"
                         />
                       </Box>
                     )}
                  </Box>
                ) : null}
              </Box>
            )}

            {/* Step 3: Ticket Details */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: '50%', 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}>
                  3
                </Box>
                Ticket Details
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Problem Description"
                  placeholder="Describe the issue or problem with the machine..."
                  multiline
                  rows={4}
                  value={formData.problem_description}
                  onChange={(e) => handleChange('problem_description', e.target.value)}
                  required
                  error={!!errors.problem_description}
                  helperText={errors.problem_description}
                />
                
                <TextField
                  fullWidth
                  label="Notes"
                  placeholder="Additional notes or observations..."
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                />
                
                <TextField
                  fullWidth
                  label="Additional Equipment"
                  placeholder="Any additional equipment brought with the machine..."
                  multiline
                  rows={2}
                  value={formData.additional_equipment}
                  onChange={(e) => handleChange('additional_equipment', e.target.value)}
                />
                
                <TextField
                  fullWidth
                  label="Brought By"
                  placeholder="Name of person who brought the machine (or express mail company)"
                  value={formData.brought_by}
                  onChange={(e) => handleChange('brought_by', e.target.value)}
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Submitted by:</strong> {user?.name || 'Current User'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={handleClose}
            variant="outlined"
            sx={{ minWidth: 100 }}
            disabled={createMutation.isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={createMutation.isLoading}
            startIcon={createMutation.isLoading ? <CircularProgress size={16} /> : <TicketIcon />}
            sx={{ minWidth: 140 }}
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Ticket'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateWarrantyRepairTicketModal;
