import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Engineering as EngineeringIcon
} from '@mui/icons-material';
import { FormLayout, FormField } from '../index';
import { invalidateTicketQueries, invalidateCustomerQueries, invalidateMachineQueries, invalidateDashboardQueries } from '../../utils/cacheUtils.js';

const STEPS = ['Customer', 'Machine', 'TicketDetails'];

// Helper function to format date from YYYY-MM-DD to DD.MM.YYYY
const formatDateToDDMMYYYY = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
};

// Helper function to get step label with fallback
const getStepLabel = (label, translate) => {
  // Create proper key mapping for step labels
  const stepKeyMap = {
    'Customer': 'forms.stepCustomer',
    'Machine': 'forms.stepMachine',
    'TicketDetails': 'forms.stepTicketDetails'
  };
  
  const key = stepKeyMap[label];
  const translation = translate(key);
  
  // If translation returns the key itself, use fallback
  if (translation === key) {
    const fallbackLabels = {
      'Customer': 'Customer',
      'Machine': 'Machine', 
      'TicketDetails': 'Ticket Details'
    };
    return fallbackLabels[label] || label;
  }
  
  return translation;
};

// Helper function to safely translate with fallback
const safeTranslate = (key, translate, fallback = null) => {
  const translation = translate(key);
  
  // If translation returns the key itself, use fallback or the key
  if (translation === key) {
    console.warn(`Translation key not found: ${key}`);
    return fallback || key;
  }
  
  return translation;
};

const TicketCreationWizard = ({ ticketType = 'repair', onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [wizardData, setWizardData] = useState({
    customer: null,
    machine: null,
    machineModel: null,
    serialNumber: '',
    purchaseDate: '',
    ticketDetails: {
      problemDescription: '',
      notes: '',
      additionalEquipment: '',
      broughtBy: ''
    }
  });
  
  // Dialog states
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [showNewMachineDialog, setShowNewMachineDialog] = useState(false);
  const [showNewModelDialog, setShowNewModelDialog] = useState(false);
  
  // Selection states
  const [customerType, setCustomerType] = useState('existing'); // 'existing' | 'new'
  const [machineType, setMachineType] = useState('existing'); // 'existing' | 'new'
  const [modelType, setModelType] = useState('existing'); // 'existing' | 'new'
  
  // Form states
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    company_name: '',
    city: '',
    postal_code: ''
  });
  
  const [newModel, setNewModel] = useState({
    name: '',
    manufacturer: '',
    catalogue_number: '',
    warranty_months: 12,
    category_id: null
  });

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    contact_person: ''
  });

  const [newCategory, setNewCategory] = useState({
    name: ''
  });

  const [boughtAt, setBoughtAt] = useState('');
  const [displayDate, setDisplayDate] = useState('');

  // Update display date when purchase date changes
  React.useEffect(() => {
    if (wizardData.purchaseDate && !displayDate) {
      setDisplayDate(formatDateToDDMMYYYY(wizardData.purchaseDate));
    }
  }, [wizardData.purchaseDate, displayDate]);

  const { user } = useAuth();
  const { translate: t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch customers for autocomplete
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', { search: '' }],
    queryFn: async () => {
      const response = await api.get('/customers?limit=100');
      return response.data;
    }
  });

  // Fetch assigned machines for selected customer
  const { data: customerMachinesData, isLoading: machinesLoading } = useQuery({
    queryKey: ['assigned-machines', wizardData.customer?.id],
    queryFn: async () => {
      if (!wizardData.customer?.id) return { data: [] };
      const response = await api.get(`/assigned-machines/customer/${wizardData.customer.id}`);
      return response.data;
    },
    enabled: !!wizardData.customer?.id
  });

  // Fetch machine models for autocomplete
  const { data: machineModelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['machine-models', { search: '' }],
    queryFn: async () => {
      const response = await api.get('/machines/models?limit=100');
      return response.data;
    }
  });

  // Fetch machine categories
  const { data: categoriesData } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: async () => {
      const response = await api.get('/machines/categories');
      return response.data;
    }
  });

  // Fetch suppliers for "Bought At" dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/suppliers?limit=100');
      return response.data;
    }
  });

  // Fetch unique manufacturers from existing models
  const { data: manufacturersData } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.get('/machines/models?limit=1000');
      const models = response.data?.data || [];
      
      // Extract unique manufacturers
      const manufacturers = [...new Set(models.map(model => model.manufacturer).filter(Boolean))];
      return { data: manufacturers.map(name => ({ name })) };
    }
  });

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData) => {
      const response = await api.post('/customers', customerData);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate and refetch customer queries
      await invalidateCustomerQueries(queryClient);
      
      // Also invalidate dashboard since customer creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      setWizardData(prev => ({ ...prev, customer: data.data }));
      setShowNewCustomerDialog(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        address: '',
        company_name: '',
        city: '',
        postal_code: ''
      });
      toast.success(t('forms.customerCreatedSuccessfully'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToCreateCustomer'));
    }
  });

  const createModelMutation = useMutation({
    mutationFn: async (modelData) => {
      const response = await api.post('/machines/models', modelData);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate and refetch machine queries
      await invalidateMachineQueries(queryClient);
      
      // Also invalidate dashboard since machine creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      setWizardData(prev => ({ ...prev, machineModel: data.data }));
      setShowNewModelDialog(false);
      setNewModel({
        name: '',
        manufacturer: '',
        catalogue_number: '',
        warranty_months: 12,
        category_id: null
      });
      toast.success(t('forms.machineModelCreatedSuccessfully'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToCreateMachineModel'));
    }
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (supplierData) => {
      const response = await api.post('/suppliers', supplierData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['suppliers']);
      setBoughtAt(data.data.name);
      setNewSupplier({
        name: '',
        email: '',
        phone: '',
        address: '',
        contact_person: ''
      });
      toast.success(t('forms.supplierCreatedSuccessfully'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToCreateSupplier'));
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData) => {
      const response = await api.post('/machines/categories', categoryData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['machine-categories']);
      setNewModel(prev => ({ ...prev, category_id: data.data.id }));
      setNewCategory({ name: '' });
      toast.success(t('forms.categoryCreatedSuccessfully'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToCreateCategory'));
    }
  });

  const assignMachineMutation = useMutation({
    mutationFn: async (machineData) => {
      if (machineType === 'new') {
        // Check if we have customer data
        if (!wizardData.customer?.id) {
          throw new Error(t('forms.customerInformationMissing'));
        }

        // Use the /machines/assign endpoint which creates serial and assigns in one call
        const response = await api.post('/machines/assign', {
          model_id: wizardData.machineModel.id,
          serial_number: wizardData.serialNumber,
          customer_id: wizardData.customer.id,
          purchase_date: wizardData.purchaseDate || null,
          description: boughtAt || `Assigned for ${ticketType} ticket creation`
        });
        return response.data;
      } else {
        // For existing machines, we still need the assigned-machines endpoint
        const response = await api.post('/assigned-machines', {
          customer_id: wizardData.customer.id,
          serial_id: wizardData.machine.serial_id,
          purchase_date: wizardData.purchaseDate || null,
          description: boughtAt || `Assigned for ${ticketType} ticket creation`
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['assigned-machines']);
      // The /machines/assign endpoint returns { serial: {...}, assignment: {...} }
      const assignmentData = data.data?.assignment || data.assignment;
      const serialData = data.data?.serial || data.serial;
      
      const machineData = {
        id: assignmentData?.id,
        serial_id: serialData?.id,
        serial_number: wizardData.serialNumber,
        model_name: wizardData.machineModel?.name,
        customer_id: wizardData.customer.id,
        purchase_date: assignmentData?.purchase_date,
        warranty_expiry_date: assignmentData?.warranty_expiry_date,
        warranty_active: assignmentData?.warranty_active
      };
      setWizardData(prev => ({ ...prev, machine: machineData }));
      setShowNewMachineDialog(false);
      toast.success(t('forms.machineAssignedSuccessfully'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToAssignMachine'));
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData) => {
      const endpoint = ticketType === 'warranty' ? '/warrantyRepairTickets' : '/repairTickets';
      const response = await api.post(endpoint, ticketData);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate and refetch ticket queries
      await invalidateTicketQueries(queryClient, ticketType === 'warranty' ? 'warranty' : 'non-warranty');
      
      // Also invalidate dashboard since ticket creation affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(ticketType === 'warranty' ? t('forms.warrantyRepairTicketCreated') : t('forms.repairTicketCreated'));
      
      if (onSuccess) {
        onSuccess(data.data);
      } else {
        navigate(`/${ticketType === 'warranty' ? 'warranty-repair-tickets' : 'repair-tickets'}/${data.data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('forms.failedToCreateTicket'));
    }
  });

  const handleNext = async () => {
    if (activeStep === 0) {
      // Customer step validation
      if (!wizardData.customer && customerType === 'existing') {
        toast.error(t('forms.pleaseSelectCustomer'));
        return;
      }
      if (customerType === 'new' && !newCustomer.name) {
        toast.error(t('forms.customerNameRequired'));
        return;
      }
      if (customerType === 'new') {
        await createCustomerMutation.mutateAsync(newCustomer);
      }
      
      // Ensure we have customer data before proceeding
      if (!wizardData.customer?.id) {
        toast.error(t('forms.customerDataMissing'));
        return;
      }
    } else if (activeStep === 1) {
      // Machine step validation
      if (machineType === 'existing' && !wizardData.machine) {
        toast.error(t('forms.pleaseSelectMachine'));
        return;
      }
      if (machineType === 'new') {
        if (!wizardData.machineModel && modelType === 'existing') {
          toast.error(t('forms.pleaseSelectMachineModel'));
          return;
        }
        if (modelType === 'new' && !newModel.name) {
          toast.error(t('forms.modelNameRequired'));
          return;
        }
        if (!wizardData.serialNumber) {
          toast.error(t('forms.serialNumberRequired'));
          return;
        }
        
        // Create model if needed
        if (modelType === 'new') {
          await createModelMutation.mutateAsync(newModel);
        }
        
        // Assign machine
        await assignMachineMutation.mutateAsync();
      }
    }
    
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!wizardData.ticketDetails.problemDescription) {
      toast.error(t('forms.enterProblemDescription'));
      return;
    }

    const ticketData = {
      customer_id: wizardData.customer.id,
      machine_id: wizardData.machine.id,
      problem_description: wizardData.ticketDetails.problemDescription,
      notes: wizardData.ticketDetails.notes,
      additional_equipment: wizardData.ticketDetails.additionalEquipment,
      brought_by: wizardData.ticketDetails.broughtBy,
      submitted_by: user.id
    };

    await createTicketMutation.mutateAsync(ticketData);
  };

  const renderCustomerStep = () => (
    <FormLayout title={safeTranslate('forms.selectOrCreateCustomer', t, 'Select or Create Customer')}>
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={customerType}
          exclusive
          onChange={(e, value) => {
            if (value) {
              setCustomerType(value);
              // Clear selected customer when switching to new customer mode
              if (value === 'new') {
                setWizardData(prev => ({ ...prev, customer: null }));
              }
            }
          }}
          sx={{ mb: 3 }}
        >
          <ToggleButton value="existing">
            <SearchIcon sx={{ mr: 1 }} />
            {safeTranslate('forms.selectExistingCustomer', t, 'Select Existing Customer')}
          </ToggleButton>
          <ToggleButton value="new">
            <PersonAddIcon sx={{ mr: 1 }} />
            {safeTranslate('forms.createNewCustomer', t, 'Create New Customer')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {customerType === 'existing' ? (
        <Autocomplete
          options={customersData?.data || []}
          getOptionLabel={(option) => `${option.name}${option.company_name ? ` (${option.company_name})` : ''}`}
          value={wizardData.customer}
          onChange={(e, value) => setWizardData(prev => ({ ...prev, customer: value }))}
          loading={customersLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              label={safeTranslate('forms.searchCustomersPlaceholder', t, 'Type to search for customers...')}
              variant="outlined"
              fullWidth
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {customersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props}>
              <Box>
                <Typography variant="body1">{option.name}</Typography>
                {option.company_name && (
                  <Typography variant="body2" color="textSecondary">
                    {option.company_name}
                  </Typography>
                )}
                {option.email && (
                  <Typography variant="caption" color="textSecondary">
                    {option.email} • {option.phone || t('common.noPhone')}
                  </Typography>
                )}
              </Box>
            </li>
          )}
        />
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.customerName')}
              value={newCustomer.name}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.companyName')}
              value={newCustomer.company_name}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, company_name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.email')}
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.phone')}
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <FormField
              label={t('forms.address')}
              value={newCustomer.address}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.city')}
              value={newCustomer.city}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              label={t('forms.postalCode')}
              value={newCustomer.postal_code}
              onChange={(e) => setNewCustomer(prev => ({ ...prev, postal_code: e.target.value }))}
            />
          </Grid>
        </Grid>
      )}

      {wizardData.customer && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.50' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CheckCircleIcon color="success" sx={{ mr: 1 }} />
            {t('forms.selectedCustomer')}
          </Typography>
          <Typography variant="body1">{wizardData.customer.name}</Typography>
          {wizardData.customer.company_name && (
            <Typography variant="body2" color="textSecondary">
              {wizardData.customer.company_name}
            </Typography>
          )}
          <Typography variant="caption" color="textSecondary">
            {wizardData.customer.email} • {wizardData.customer.phone || t('common.noPhone')}
          </Typography>
        </Paper>
      )}
    </FormLayout>
  );

  const renderMachineStep = () => (
    <FormLayout title={t('forms.selectOrAddMachine')}>
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={machineType}
          exclusive
          onChange={(e, value) => value && setMachineType(value)}
          sx={{ mb: 3 }}
        >
          <ToggleButton value="existing">
            <SearchIcon sx={{ mr: 1 }} />
            {t('forms.selectExistingMachine')}
          </ToggleButton>
          <ToggleButton value="new">
            <BuildIcon sx={{ mr: 1 }} />
            {t('forms.addNewMachine')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {machineType === 'existing' ? (
        <>
          {customerMachinesData?.data?.length > 0 ? (
            <Grid container spacing={2}>
              {customerMachinesData.data.map((machine) => (
                <Grid item xs={12} md={6} key={machine.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      border: wizardData.machine?.id === machine.id ? 2 : 1,
                      borderColor: wizardData.machine?.id === machine.id ? 'primary.main' : 'divider'
                    }}
                    onClick={() => setWizardData(prev => ({ ...prev, machine }))}
                  >
                    <CardContent>
                      <Typography variant="h6">{machine.model_name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {t('forms.serialNumber')}: {machine.serial_number}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {machine.manufacturer}
                      </Typography>
                      {machine.warranty_active && (
                        <Chip 
                          label={t('status.underWarranty')} 
                          color="success" 
                          size="small" 
                          sx={{ mt: 1 }} 
                        />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('forms.noMachinesFound')}
            </Alert>
          )}
        </>
      ) : (
        <Box>
          <Box sx={{ mb: 3 }}>
            <ToggleButtonGroup
              value={modelType}
              exclusive
              onChange={(e, value) => value && setModelType(value)}
              sx={{ mb: 3 }}
            >
              <ToggleButton value="existing">
                <SearchIcon sx={{ mr: 1 }} />
                {t('forms.selectExistingModel')}
              </ToggleButton>
              <ToggleButton value="new">
                <EngineeringIcon sx={{ mr: 1 }} />
                {t('forms.createNewModel')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {modelType === 'existing' ? (
            <Autocomplete
              options={machineModelsData?.data || []}
              getOptionLabel={(option) => `${option.name} - ${option.manufacturer}`}
              value={wizardData.machineModel}
              onChange={(e, value) => setWizardData(prev => ({ ...prev, machineModel: value }))}
              loading={modelsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('forms.searchMachineModels')}
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {modelsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {option.manufacturer} • {option.catalogue_number || t('common.noCatalogueNumber')}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormField
                  label={t('forms.modelName')}
                  value={newModel.name}
                  onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={manufacturersData?.data || []}
                  getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                  value={newModel.manufacturer}
                  onChange={(e, value) => {
                    if (typeof value === 'string') {
                      setNewModel(prev => ({ ...prev, manufacturer: value }));
                    } else if (value) {
                      setNewModel(prev => ({ ...prev, manufacturer: value.name }));
                    } else {
                      setNewModel(prev => ({ ...prev, manufacturer: '' }));
                    }
                  }}
                  onInputChange={(e, value) => {
                    setNewModel(prev => ({ ...prev, manufacturer: value }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('forms.manufacturer')}
                      placeholder={t('forms.searchOrTypeManufacturer')}
                      helperText={t('forms.selectOrTypeManufacturer')}
                      required
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Typography variant="body1">{option.name}</Typography>
                    </li>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormField
                  label={t('forms.catalogueNumber')}
                  value={newModel.catalogue_number}
                  onChange={(e) => setNewModel(prev => ({ ...prev, catalogue_number: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={categoriesData?.data || []}
                  getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                  value={categoriesData?.data?.find(cat => cat.id === newModel.category_id) || null}
                  onChange={(e, value) => {
                    if (typeof value === 'string') {
                      // User typed a new category
                      setNewCategory({ name: value });
                      createCategoryMutation.mutate({ name: value });
                    } else if (value) {
                      setNewModel(prev => ({ ...prev, category_id: value.id }));
                    } else {
                      setNewModel(prev => ({ ...prev, category_id: null }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('forms.category')}
                      placeholder={t('forms.searchOrAddCategory')}
                      helperText={t('forms.typeToSearchOrAddCategory')}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Typography variant="body1">{option.name}</Typography>
                    </li>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormField
                  label={t('forms.warrantyPeriod')}
                  type="number"
                  value={newModel.warranty_months}
                  onChange={(e) => setNewModel(prev => ({ ...prev, warranty_months: parseInt(e.target.value) || 12 }))}
                />
              </Grid>
            </Grid>
          )}

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormField
                label={t('forms.serialNumber')}
                value={wizardData.serialNumber}
                onChange={(e) => setWizardData(prev => ({ ...prev, serialNumber: e.target.value }))}
                required
              />
            </Grid>
            {ticketType === 'warranty' && (
              <Grid item xs={12} md={6}>
                <TextField
                  label={t('forms.purchaseDate')}
                  placeholder={t('forms.dateFormatPlaceholder')}
                  value={displayDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    
                    // Auto-format as user types
                    let formatted = value.replace(/\D/g, ''); // Remove non-digits
                    if (formatted.length >= 2) {
                      formatted = formatted.substring(0, 2) + '.' + formatted.substring(2);
                    }
                    if (formatted.length >= 5) {
                      formatted = formatted.substring(0, 5) + '.' + formatted.substring(5, 9);
                    }
                    if (formatted.length > 10) {
                      formatted = formatted.substring(0, 10);
                    }
                    
                    // Update display
                    setDisplayDate(formatted);
                    
                    // Convert to ISO format if complete and valid
                    if (formatted.length === 10) {
                      const [day, month, year] = formatted.split('.');
                      const dayNum = parseInt(day);
                      const monthNum = parseInt(month);
                      const yearNum = parseInt(year);
                      
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        setWizardData(prev => ({ ...prev, purchaseDate: isoDate }));
                      } else {
                        setWizardData(prev => ({ ...prev, purchaseDate: '' }));
                      }
                    } else {
                      setWizardData(prev => ({ ...prev, purchaseDate: '' }));
                    }
                  }}
                  helperText={t('forms.purchaseDateHelper')}
                  fullWidth
                  inputProps={{
                    maxLength: 10
                  }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Autocomplete
                freeSolo
                options={suppliersData?.data || []}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={boughtAt}
                onChange={(e, value) => {
                  if (typeof value === 'string') {
                    setBoughtAt(value);
                  } else if (value) {
                    setBoughtAt(value.name);
                  } else {
                    setBoughtAt('');
                  }
                }}
                onInputChange={(e, value) => {
                  setBoughtAt(value);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('forms.boughtAt')}
                    placeholder={t('forms.searchVendorsOrType')}
                    helperText={t('forms.selectVendorOrTypeNew')}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {params.InputProps.endAdornment}
                          {boughtAt && !suppliersData?.data?.find(s => s.name === boughtAt) && (
                            <Button
                              size="small"
                              onClick={() => {
                                if (boughtAt.trim()) {
                                  createSupplierMutation.mutate({ name: boughtAt.trim() });
                                }
                              }}
                              sx={{ ml: 1 }}
                            >
                              {t('actions.add')}
                            </Button>
                          )}
                        </>
                      )
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      {option.contact_person && (
                        <Typography variant="body2" color="textSecondary">
                          {t('forms.contact')}: {option.contact_person}
                        </Typography>
                      )}
                      {option.phone && (
                        <Typography variant="caption" color="textSecondary">
                          {option.phone}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
              />
            </Grid>
          </Grid>
        </Box>
      )}
    </FormLayout>
  );

  const renderTicketDetailsStep = () => (
    <FormLayout title={ticketType === 'warranty' ? t('forms.createWarrantyRepairTicket') : t('forms.createRepairTicket')}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormField
            label={t('forms.problemDescription')}
            value={wizardData.ticketDetails.problemDescription}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, problemDescription: e.target.value }
            }))}
            multiline
            rows={4}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <FormField
            label={t('forms.additionalNotes')}
            value={wizardData.ticketDetails.notes}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, notes: e.target.value }
            }))}
            multiline
            rows={3}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormField
            label={t('forms.additionalEquipment')}
            value={wizardData.ticketDetails.additionalEquipment}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, additionalEquipment: e.target.value }
            }))}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormField
            label={t('forms.broughtBy')}
            value={wizardData.ticketDetails.broughtBy}
            onChange={(e) => setWizardData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, broughtBy: e.target.value }
            }))}
          />
        </Grid>
      </Grid>

      {/* Summary */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t('forms.ticketSummary')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="textSecondary">{t('forms.customer')}</Typography>
            <Typography variant="body1">{wizardData.customer?.name}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="textSecondary">{safeTranslate('forms.machine', t, 'Machine')}</Typography>
            <Typography variant="body1">
              {wizardData.machine?.model_name || wizardData.machineModel?.name}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="textSecondary">{safeTranslate('forms.serialNumber', t, 'Serial Number')}</Typography>
            <Typography variant="body1">
              {wizardData.machine?.serial_number || wizardData.serialNumber || safeTranslate('common.notApplicable', t, 'N/A')}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">{safeTranslate('forms.problem', t, 'Problem')}</Typography>
            <Typography 
              variant="body1" 
              sx={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                lineHeight: 1.5
              }}
            >
              {wizardData.ticketDetails.problemDescription}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </FormLayout>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderCustomerStep();
      case 1:
        return renderMachineStep();
      case 2:
        return renderTicketDetailsStep();
      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
            <AssignmentIcon sx={{ mr: 2 }} />
            {ticketType === 'warranty' ? safeTranslate('forms.createWarrantyRepairTicket', t, 'Create Warranty Repair Ticket') : safeTranslate('forms.createRepairTicket', t, 'Create Repair Ticket')}
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{getStepLabel(label, t)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              {safeTranslate('forms.back', t, 'Back')}
            </Button>
            
            {activeStep === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                variant="contained"
                disabled={createTicketMutation.isLoading}
                startIcon={createTicketMutation.isLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              >
                {safeTranslate('forms.createTicket', t, 'Create Ticket')}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                variant="contained"
                disabled={
                  createCustomerMutation.isLoading ||
                  createModelMutation.isLoading ||
                  assignMachineMutation.isLoading
                }
                startIcon={
                  (createCustomerMutation.isLoading || createModelMutation.isLoading || assignMachineMutation.isLoading) 
                    ? <CircularProgress size={20} /> 
                    : null
                }
              >
                {safeTranslate('forms.next', t, 'Next')}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TicketCreationWizard;
