import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Tabs,
  Tab,
  Menu,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Stack
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Category as CategoryIcon,
  Build as BuildIcon,
  MoreVert as MoreVertIcon,
  Security as SecurityIcon,
  CalendarToday as CalendarIcon,
  Receipt as ReceiptIcon,
  PersonAdd as PersonAddIcon,
  ConfirmationNumber as SerialIcon,
  TrendingUp as SalesIcon,
  AttachMoney as MoneyIcon,
  Store as StoreIcon,
  Assessment as MetricsIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function MachineModelDetail() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { translate, formatDate, parseFormattedDate } = useLanguage();
  const { user, isAdmin, isManager } = useAuth();

  // State
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serialToDelete, setSerialToDelete] = useState(null);
  const [serialMenuAnchorEl, setSerialMenuAnchorEl] = useState(null);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [assignFormData, setAssignFormData] = useState({
    serial_number: '',
    customer_id: '',
    purchase_date: '',
    receipt_number: ''
  });
  const [purchaseDateFormatted, setPurchaseDateFormatted] = useState('');

  // Fetch machine model details
  const { data: modelData, isLoading, error, refetch } = useQuery({
    queryKey: ['machine-model', modelId, warrantyFilter],
    queryFn: async () => {
      const params = warrantyFilter !== 'all' ? { warranty_status: warrantyFilter } : {};
      const response = await api.get(`/machines/models/${modelId}`, { params });
      return response.data.data;
    },
  });

  // Fetch customers for assignment
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutations
  const assignSerial = useMutation({
    mutationFn: (data) => api.post('/machines/assign', {
      ...data,
      model_id: parseInt(modelId), // Add the model_id from URL params
      model_name: modelData?.model.name,
      catalogue_number: modelData?.model.catalogue_number,
      manufacturer: modelData?.model.manufacturer
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-model'] });
      toast.success(translate('notifications.serialAssigned'));
      setAssignDialogOpen(false);
      setAssignFormData({
        serial_number: '',
        customer_id: '',
        purchase_date: '',
        receipt_number: ''
      });
      setPurchaseDateFormatted('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToAssignSerial'));
    },
  });

  const deleteSerial = useMutation({
    mutationFn: (serialId) => api.delete(`/machines/serials/${serialId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-model'] });
      toast.success(translate('notifications.serialDeleted'));
      setDeleteDialogOpen(false);
      setSerialToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteSerial'));
    },
  });

  const deleteModel = useMutation({
    mutationFn: () => api.delete(`/machines/models/${modelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-models'] });
      toast.success(translate('notifications.machineModelDeleted'));
      navigate('/machines');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteMachineModel'));
    },
  });

  // Handlers
  const handleAssignSerial = () => {
    if (!assignFormData.serial_number || !assignFormData.customer_id) {
      toast.error(translate('errors.serialNumberAndCustomerRequired'));
      return;
    }
    
    // Convert formatted date to ISO format for backend
    let dataToSend = { ...assignFormData };
    if (purchaseDateFormatted) {
      const parsedDate = parseFormattedDate(purchaseDateFormatted);
      if (parsedDate) {
        dataToSend.purchase_date = parsedDate.toISOString().split('T')[0];
      }
    }
    
    // Remove description from the data since it should come from the machine model
    const { description, ...finalData } = dataToSend;
    assignSerial.mutate(finalData);
  };

  const handleDeleteSerial = (serial) => {
    setSerialToDelete(serial);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSerial = () => {
    if (serialToDelete) {
      deleteSerial.mutate(serialToDelete.id);
    }
  };

  const handleSerialMenuOpen = (event, serial) => {
    setSerialMenuAnchorEl(event.currentTarget);
    setSelectedSerial(serial);
  };

  const handleSerialMenuClose = () => {
    setSerialMenuAnchorEl(null);
    setSelectedSerial(null);
  };

  const handleSerialMenuAction = (action) => {
    if (!selectedSerial) return;
    
    switch (action) {
      case 'edit':
        toast.info(translate('common.comingSoon'));
        break;
      case 'delete':
        handleDeleteSerial(selectedSerial);
        break;
      default:
        break;
    }
    handleSerialMenuClose();
  };

  const handleDeleteModel = () => {
    deleteModel.mutate();
  };

  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setAssignFormData({
      serial_number: '',
      customer_id: '',
      purchase_date: '',
      receipt_number: ''
    });
    setPurchaseDateFormatted('');
  };

  const getWarrantyStatusChip = (warrantyActive, warrantyExpiry) => {
    if (!warrantyExpiry) {
      return <Chip label={translate('common.noWarranty')} color="default" size="small" />;
    }
    
    if (warrantyActive) {
      return (
        <Chip 
          icon={<CheckCircleIcon />} 
          label={translate('common.warrantyActive')} 
          color="success" 
          size="small" 
        />
      );
    } else {
      return (
        <Chip 
          icon={<WarningIcon />} 
          label={translate('common.warrantyExpired')} 
          color="error" 
          size="small" 
        />
      );
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {error.message}
        </Alert>
      </Box>
    );
  }

  const { model, serials } = modelData || {};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/machines')}
            sx={{ mr: 2 }}
          >
            {translate('navigation.back')}
          </Button>
          <Typography variant="h4" component="h1">
            {model?.name}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAssignDialogOpen(true)}
          >
            {translate('actions.assignSerial')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDeleteModel}
            disabled={model?.total_assigned > 0}
          >
            {translate('actions.deleteModel')}
          </Button>
        </Box>
      </Box>

      {/* Model Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {translate('common.modelInformation')}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" mb={2}>
                <BuildIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.modelName')}:</strong> {model?.name}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <BusinessIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.manufacturer')}:</strong> {model?.manufacturer}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <DescriptionIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.catalogueNumber')}:</strong> {model?.catalogue_number || translate('common.notSpecified')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" mb={2}>
                <CategoryIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.category')}:</strong> {model?.category_name || translate('common.notSpecified')}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <PersonIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.totalAssigned')}:</strong> {model?.total_assigned}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <ScheduleIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('common.activeWarranty')}:</strong> {model?.active_warranty} / {model?.total_assigned}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>{translate('tableHeaders.warrantyPeriod')}:</strong> {model?.warranty_months || 12} months
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Sales Metrics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SalesIcon />
            {translate('common.salesMetrics')}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <StoreIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body1">
                  <strong>{translate('common.totalSales')}:</strong> {model?.total_sales || 0}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <PersonAddIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="body1">
                  <strong>{translate('common.totalAssignments')}:</strong> {model?.total_assignments || 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body1">
                  <strong>{translate('forms.new')}:</strong> {model?.new_machines_sold || 0}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="body1">
                  <strong>{translate('forms.used')}:</strong> {model?.used_machines_sold || 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <MoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body1">
                  <strong>{translate('common.totalRevenue')}:</strong> €{parseFloat(model?.total_sales_revenue || 0).toFixed(2)}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" mb={2}>
                <MetricsIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="body1">
                  <strong>{translate('common.avgSalePrice')}:</strong> €{parseFloat(model?.avg_sale_price || 0).toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <SalesIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body1">
                  <strong>{translate('common.salesRatio')}:</strong> {
                    model?.total_assigned > 0 
                      ? `${Math.round((model?.total_sales || 0) / model?.total_assigned * 100)}%`
                      : '0%'
                  }
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Warranty Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{translate('common.warrantyStatus')}</InputLabel>
          <Select
            value={warrantyFilter}
            onChange={(e) => setWarrantyFilter(e.target.value)}
            label={translate('common.warrantyStatus')}
          >
            <MenuItem value="all">{translate('common.all')}</MenuItem>
            <MenuItem value="active">{translate('common.active')}</MenuItem>
            <MenuItem value="expired">{translate('common.expired')}</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Serials Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('tableHeaders.serialNumber')}</TableCell>
                <TableCell>{translate('tableHeaders.customer')}</TableCell>
                <TableCell>{translate('forms.transactionType')}</TableCell>
                <TableCell>{translate('forms.soldBy')}</TableCell>
                <TableCell>{translate('forms.salePrice')}</TableCell>
                <TableCell>{translate('tableHeaders.purchaseDate')}</TableCell>
                <TableCell>{translate('tableHeaders.warrantyExpiry')}</TableCell>
                <TableCell>{translate('tableHeaders.warrantyStatus')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serials?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    {translate('common.noSerialsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                serials?.map((serial) => (
                  <TableRow 
                    key={serial.id}
                    hover
                    sx={{ cursor: serial.assigned_machine_id ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (serial.assigned_machine_id) {
                        navigate(`/machines/detail/${serial.assigned_machine_id}`);
                      } else {
                        // Handle unassigned machines - maybe show a message or disable click
                        console.log('Machine is not assigned to any customer');
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {serial.serial_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {serial.customer_name ? (
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {serial.customer_name}
                          </Typography>
                          {serial.company_name && (
                            <Typography variant="caption" color="textSecondary">
                              {serial.company_name}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Chip label={translate('common.unassigned')} color="default" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {serial.assigned_machine_id ? (
                        <Chip
                          label={serial.is_sale ? translate('forms.sale') : translate('forms.assignment')}
                          color={serial.is_sale ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {serial.sold_by_name || (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {serial.sale_price ? (
                        <Typography variant="body2" fontWeight="medium">
                          €{parseFloat(serial.sale_price).toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {serial.purchase_date ? formatDate(serial.purchase_date) : translate('common.notSpecified')}
                    </TableCell>
                    <TableCell>
                      {serial.warranty_expiry_date ? formatDate(serial.warranty_expiry_date) : translate('common.notSpecified')}
                    </TableCell>
                    <TableCell>
                      {getWarrantyStatusChip(serial.warranty_active, serial.warranty_expiry_date)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSerialMenuOpen(e, serial);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Assign Serial Dialog */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={handleCloseAssignDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
                 <DialogTitle sx={{ 
           pb: 2, 
           borderBottom: '1px solid',
           borderColor: 'divider',
           display: 'flex',
           alignItems: 'center',
           gap: 1
         }}>
           <PersonAddIcon color="primary" />
           {translate('actions.assignSerial')}
         </DialogTitle>
         <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Box sx={{ height: 20 }} /> {/* Spacer to push content down */}
          <Stack spacing={3}>
            {/* Serial Number */}
            <TextField
              fullWidth
              label={translate('tableHeaders.serialNumber')}
              value={assignFormData.serial_number}
              onChange={(e) => setAssignFormData(prev => ({ ...prev, serial_number: e.target.value }))}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SerialIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                },
                '& .MuiInputLabel-root': {
                  marginTop: '8px'
                }
              }}
            />
            
            {/* Customer Selection */}
            <FormControl fullWidth required>
              <InputLabel>{translate('tableHeaders.customer')}</InputLabel>
              <Select
                value={assignFormData.customer_id}
                onChange={(e) => setAssignFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                label={translate('tableHeaders.customer')}
                startAdornment={
                  <InputAdornment position="start">
                    <PersonIcon color="action" fontSize="small" />
                  </InputAdornment>
                }
                sx={{
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderRadius: 2
                  }
                }}
              >
                {customers?.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {customer.name}
                      </Typography>
                      {customer.company_name && (
                        <Typography variant="caption" color="textSecondary">
                          {customer.company_name}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Purchase Date */}
            <TextField
              fullWidth
              label={translate('tableHeaders.purchaseDate')}
              placeholder="dd.mm.yyyy"
              value={purchaseDateFormatted}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow digits and dots
                const filtered = value.replace(/[^\d.]/g, '');
                // Limit to dd.mm.yyyy format
                if (filtered.length <= 10) {
                  setPurchaseDateFormatted(filtered);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              helperText="Format: dd.mm.yyyy (e.g., 26.02.2025)"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            
            {/* Receipt Number */}
            <TextField
              fullWidth
              label={translate('tableHeaders.receiptNumber')}
              value={assignFormData.receipt_number}
              onChange={(e) => setAssignFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ReceiptIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button 
            onClick={handleCloseAssignDialog}
            variant="outlined"
            sx={{ borderRadius: 2, px: 3 }}
          >
            {translate('actions.cancel')}
          </Button>
          <Button
            onClick={handleAssignSerial}
            variant="contained"
            disabled={assignSerial.isPending}
            startIcon={assignSerial.isPending ? <CircularProgress size={16} /> : <PersonAddIcon />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {assignSerial.isPending ? translate('actions.assigning') : translate('actions.assign')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Serial Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('dialogs.confirmDeleteSerial')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteSerialMessage')} <strong>{serialToDelete?.serial_number}</strong>?
            <br />
            <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
              {translate('dialogs.deleteSerialWarning')}
            </Typography>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button
            onClick={confirmDeleteSerial}
            color="error"
            variant="contained"
            disabled={deleteSerial.isPending}
          >
            {deleteSerial.isPending ? translate('actions.deleting') : translate('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Serial Action Menu */}
      <Menu
        anchorEl={serialMenuAnchorEl}
        open={Boolean(serialMenuAnchorEl)}
        onClose={handleSerialMenuClose}
      >
        <MenuItem onClick={() => handleSerialMenuAction('edit')}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.edit')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSerialMenuAction('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.deleteSerial')}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
