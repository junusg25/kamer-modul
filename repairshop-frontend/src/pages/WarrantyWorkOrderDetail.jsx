import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  Divider,
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
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  LinearProgress,
  Badge,
} from '@mui/material'
import { DatePicker, DateTimePicker } from '@mui/x-date-pickers'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { de } from 'date-fns/locale'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  ConfirmationNumber as TicketIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityHighIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  Description as DescriptionIcon,
  Engineering as EngineeringIcon,
  Add as AddIcon,
  Note as NoteIcon,
  Inventory as InventoryIcon,
  ExpandMore as ExpandMoreIcon,
  AttachMoney as MoneyIcon,
  AccessTime as TimeIcon,
  Security as SecurityIcon,
  Receipt as ReceiptIcon,
  LocalShipping as ShippingIcon,
  CalendarToday as CalendarIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateDashboardCache, invalidateWarrantyWorkOrdersCache } from '../utils/cacheUtils.js'

// Customer Info Component
const CustomerInfo = ({ customerId }) => {
  const { translate } = useLanguage()
  const customerQuery = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => (await api.get(`/customers/${customerId}`)).data.data,
    enabled: !!customerId,
  })

  if (!customerId) {
    return (
      <Typography variant="body2" color="text.secondary">
        {translate('common.noCustomerAssigned')}
      </Typography>
    )
  }

  if (customerQuery.isLoading) {
    return <CircularProgress size={20} />
  }

  if (customerQuery.error) {
    return (
      <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
        {customerQuery.error.message}
      </Alert>
    )
  }

  const customer = customerQuery.data

  return (
    <List dense>
      <ListItem sx={{ px: 0 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <PersonIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary={customer.name}
          secondary={translate('forms.customerName')}
        />
      </ListItem>
      
      {customer.company_name && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.company_name}
            secondary={translate('forms.companyName')}
          />
        </ListItem>
      )}
      
      {customer.email && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <EmailIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.email}
            secondary={translate('forms.email')}
          />
        </ListItem>
      )}
      
      {customer.phone && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <PhoneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.phone}
            secondary={translate('forms.phone1')}
          />
        </ListItem>
      )}
      
      {customer.phone2 && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <PhoneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.phone2}
            secondary={translate('forms.phone2')}
          />
        </ListItem>
      )}
      
      {customer.city && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <LocationOnIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.city}
            secondary={translate('forms.city')}
          />
        </ListItem>
      )}
      
      {customer.street_address && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <LocationOnIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={customer.street_address}
            secondary={translate('forms.streetAddress')}
          />
        </ListItem>
      )}
    </List>
  )
}

// Machine Info Component
const MachineInfo = ({ machineId, workOrder }) => {
  const { translate, formatDate, formatDateTime, formatDateTimeForInput, parseFormattedDateTime } = useLanguage()
  const machineQuery = useQuery({
    queryKey: ['machine', machineId],
    queryFn: async () => (await api.get(`/machines/${machineId}`)).data.data,
    enabled: !!machineId,
  })

  if (!machineId) {
    return (
      <Typography variant="body2" color="text.secondary">
        {translate('common.noMachineAssigned')}
      </Typography>
    )
  }

  if (machineQuery.isLoading) {
    return <CircularProgress size={20} />
  }

  if (machineQuery.error) {
    return (
      <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
        {machineQuery.error.message}
      </Alert>
    )
  }

  const machine = machineQuery.data

  return (
    <List dense>
      <ListItem sx={{ px: 0 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <BuildIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary={machine.name}
          secondary={translate('common.machineName')}
        />
      </ListItem>
      
      {machine.catalogue_number && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.catalogue_number}
            secondary={translate('common.catalogueNumber')}
          />
        </ListItem>
      )}
      
      {machine.serial_number && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.serial_number}
            secondary={translate('common.serialNumber')}
          />
        </ListItem>
      )}
      
      {machine.description && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <DescriptionIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={
              <Typography
                sx={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  lineHeight: 1.4
                }}
              >
                {machine.description}
              </Typography>
            }
            secondary={translate('common.description')}
          />
        </ListItem>
      )}
      
      {machine.manufacturer && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <BuildIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.manufacturer}
            secondary={translate('forms.manufacturer')}
          />
        </ListItem>
      )}
      
      {machine.category_name && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.category_name}
            secondary={translate('forms.category')}
          />
        </ListItem>
      )}
      
      {machine.bought_at && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.bought_at}
            secondary={translate('common.boughtAt')}
          />
        </ListItem>
      )}
      
      {machine.receipt_number && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <ReceiptIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={machine.receipt_number}
            secondary={translate('forms.receiptNumber')}
          />
        </ListItem>
      )}
      
      {machine.purchase_date && (
        <ListItem sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <CalendarIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
                          primary={formatDate(machine.purchase_date)}
            secondary={translate('forms.purchaseDate')}
          />
        </ListItem>
      )}
    </List>
  )
}

export default function WarrantyWorkOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { translate, formatDate, formatDateTime, formatDateTimeForInput, parseFormattedDateTime } = useLanguage()

  const workOrderQuery = useQuery({
    queryKey: ['warrantyWorkOrder', id],
    queryFn: async () => (await api.get(`/warrantyWorkOrders/${id}`)).data.data,
  })

  const notesQuery = useQuery({
    queryKey: ['warrantyWorkOrderNotes', id],
    queryFn: async () => (await api.get(`/warrantyWorkOrders/${id}/notes`)).data.data || [],
  })

  const inventoryQuery = useQuery({
    queryKey: ['warrantyWorkOrderInventory', id],
    queryFn: async () => (await api.get(`/warrantyWorkOrders/${id}/inventory`)).data.data || [],
  })

  const allInventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await api.get('/inventory', { params: { limit: 1000 } })).data.data,
  })

  const techniciansQuery = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/users/technicians')).data.data,
    onError: (error) => {
      console.error('Error fetching technicians:', error);
    },
  })

        const updateWorkOrder = useMutation({
      mutationFn: (updates) => api.patch(`/warrantyWorkOrders/${id}`, updates).then(r => r.data),
      onSuccess: async () => {
        // Invalidate the specific warranty work order
        await queryClient.invalidateQueries({ queryKey: ['warrantyWorkOrder', id] });
        
        // Invalidate and refetch dashboard and warranty work orders caches
        await Promise.all([
          invalidateDashboardCache(queryClient),
          invalidateWarrantyWorkOrdersCache(queryClient)
        ]);
        
        toast.success(translate('notifications.warrantyWorkOrderUpdated'))
      },
    })

  const deleteWorkOrder = useMutation({
    mutationFn: () => api.delete(`/warrantyWorkOrders/${id}`).then(r => r.data),
    onSuccess: async (data) => { 
      toast.success(translate('notifications.warrantyWorkOrderDeleted')); 
      
      // Invalidate all warranty repair tickets queries (including those with query parameters)
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
      });
      
      // Invalidate all warranty work orders queries
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-work-orders' 
      });
      
      // Force refetch to ensure immediate update
      await Promise.all([
        queryClient.refetchQueries({ 
          predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
        }),
        queryClient.refetchQueries({ 
          predicate: (query) => query.queryKey[0] === 'warranty-work-orders' 
        })
      ]);
      
      // Small delay to ensure cache operations complete
      setTimeout(() => {
        navigate('/warranty-work-orders')
      }, 100) 
    },
    onError: (e) => toast.error(e?.response?.data?.message || translate('errors.deleteFailed'))
  })

      const addNote = useMutation({
      mutationFn: (content) => api.post(`/warrantyWorkOrders/${id}/notes`, { content }).then(r => r.data),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['warrantyWorkOrderNotes', id] })
        
        // Invalidate and refetch dashboard cache
        await invalidateDashboardCache(queryClient);
        
        toast.success(translate('notifications.noteAdded'))
      },
      onError: (e) => toast.error(e?.response?.data?.message || translate('errors.failedToAddNote'))
    })

      const addInventory = useMutation({
      mutationFn: (data) => api.post(`/warrantyWorkOrders/${id}/inventory`, data).then(r => r.data),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['warrantyWorkOrderInventory', id] })
        await queryClient.invalidateQueries({ queryKey: ['inventory'] })
        
        // Invalidate and refetch dashboard cache
        await invalidateDashboardCache(queryClient);
        
        toast.success(translate('notifications.partAdded'))
      },
      onError: (e) => toast.error(e?.response?.data?.message || translate('errors.failedToAddPart'))
    })

  const workOrder = workOrderQuery.data
  const isLoading = workOrderQuery.isLoading
  const error = workOrderQuery.error

  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = React.useState(false)
  const [inventoryDialogOpen, setInventoryDialogOpen] = React.useState(false)
  const [newNote, setNewNote] = React.useState('')
  const [newInventory, setNewInventory] = React.useState({ inventory_id: '', quantity: 1 })
  
  const [form, setForm] = React.useState({ 
    description: '', 
    status: 'pending', 
    priority: 'medium', 
    technician_id: '',
    started_at: '',
    completed_at: '',
    labor_hours: '',
    labor_rate: '50',
    troubleshooting_fee: '',
    quote_subtotal_parts: '',
    quote_total: '',
  })

  React.useEffect(() => {
    if (workOrder) {
      // Prioritize owner_technician_id (auto-assigned technician) over technician_id
      const technicianId = workOrder.owner_technician_id || workOrder.technician_id || '';
      
      console.log('WarrantyWorkOrder data:', {
        id: workOrder.id,
        owner_technician_id: workOrder.owner_technician_id,
        technician_id: workOrder.technician_id,
        owner_technician_name: workOrder.owner_technician_name,
        technician_name: workOrder.technician_name,
        selected_technician_id: technicianId
      });
      
      setForm({
        description: workOrder.description || '',
        status: workOrder.status || 'pending',
        priority: workOrder.priority || 'medium',
        technician_id: technicianId,
        started_at: workOrder.started_at || '',
        completed_at: workOrder.completed_at || '',
        labor_hours: workOrder.labor_hours || '',
        labor_rate: workOrder.labor_rate || '50',
        troubleshooting_fee: workOrder.troubleshooting_fee || '',
        quote_subtotal_parts: workOrder.quote_subtotal_parts || '',
        quote_total: workOrder.quote_total || '',
      })
    }
  }, [workOrder])

  // Auto-calculate parts subtotal when inventory changes
  React.useEffect(() => {
    if (inventoryQuery.data && inventoryQuery.data.length > 0) {
      const totalPartsCost = inventoryQuery.data.reduce((sum, item) => {
        return sum + (Number(item.total_price) || 0)
      }, 0)
      setForm(f => ({ ...f, quote_subtotal_parts: totalPartsCost.toFixed(2) }))
    } else {
      setForm(f => ({ ...f, quote_subtotal_parts: '0.00' }))
    }
  }, [inventoryQuery.data])

  // Warranty work orders always have $0.00 total cost
  const calculateTotalCost = () => {
    return 0.00
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    )
  }

  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'
  const canEdit = isAdmin || isManager || (user?.id && workOrder?.owner_technician_id === user.id)

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'in_progress': return 'info'
      case 'completed': return 'success'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'success'
      default: return 'default'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <ScheduleIcon />
      case 'in_progress': return <EngineeringIcon />
      case 'completed': return <CheckCircleIcon />
      case 'cancelled': return <WarningIcon />
      default: return <InfoIcon />
    }
  }

  const onSave = () => {
    const updates = {
      description: form.description,
      status: form.status,
      priority: form.priority,
      technician_id: form.technician_id ? Number(form.technician_id) : null,
    }

    // Only include numeric fields if they have values
    if (form.labor_hours && form.labor_hours !== '') {
      updates.labor_hours = Number(form.labor_hours)
    }
    if (form.labor_rate && form.labor_rate !== '') {
      updates.labor_rate = Number(form.labor_rate)
    }
    if (form.troubleshooting_fee && form.troubleshooting_fee !== '') {
      updates.troubleshooting_fee = Number(form.troubleshooting_fee)
    }
    if (form.quote_subtotal_parts && form.quote_subtotal_parts !== '') {
      updates.quote_subtotal_parts = Number(form.quote_subtotal_parts)
    }
    
    // Warranty work orders always have $0.00 total cost
    updates.quote_total = 0.00

    updateWorkOrder.mutate(updates, { onSuccess: () => setIsEditing(false) })
  }

  const onCancel = () => {
    setIsEditing(false)
    // Prioritize owner_technician_id (auto-assigned technician) over technician_id
    const technicianId = workOrder.owner_technician_id || workOrder.technician_id || '';
    
    setForm({
      description: workOrder.description || '',
      status: workOrder.status || 'pending',
      priority: workOrder.priority || 'medium',
      technician_id: technicianId,
      started_at: workOrder.started_at || '',
      completed_at: workOrder.completed_at || '',
      labor_hours: workOrder.labor_hours || '',
      labor_rate: workOrder.labor_rate || '',
      troubleshooting_fee: workOrder.troubleshooting_fee || '',
      quote_subtotal_parts: workOrder.quote_subtotal_parts || '',
      quote_total: workOrder.quote_total || '',
    })
  }

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addNote.mutate(newNote, {
      onSuccess: () => {
        setNewNote('')
        setNoteDialogOpen(false)
      }
    })
  }

  const handleAddInventory = () => {
    if (!newInventory.inventory_id || !newInventory.quantity) return
    addInventory.mutate(newInventory, {
      onSuccess: () => {
        setNewInventory({ inventory_id: '', quantity: 1 })
        setInventoryDialogOpen(false)
      }
    })
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: 'primary.main' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{ 
                width: 64, 
                height: 64, 
                bgcolor: 'primary.main',
                fontSize: '1.5rem'
              }}
            >
              <SecurityIcon />
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                  {translate('common.warrantyWorkOrderDetails')} {workOrder.formatted_number || `#${workOrder.id}`}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {translate('common.created')} {workOrder.created_at ? formatDateTime(workOrder.created_at) : translate('common.unknown')}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isEditing ? (
            <>
                              <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  disabled={!canEdit}
                  onClick={() => setIsEditing(true)}
                >
                  {translate('common.edit')}
                </Button>
              {(isAdmin || isManager || (user?.role === 'technician' && workOrder?.technician_id === user?.id)) && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {translate('common.delete')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={onCancel}>
                {translate('common.cancel')}
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateWorkOrder.isLoading}
                onClick={onSave}
              >
                {updateWorkOrder.isLoading ? translate('common.saving') : translate('common.save')}
              </Button>
            </>
          )}
          
          <Tooltip title={translate('common.print')}>
            <IconButton
              color="primary"
              onClick={() => window.open(`/api/print/warranty-workorder/${workOrder.id}`, '_blank')}
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Customer and Machine Info - Left Side (Narrower) */}
        <Box sx={{ flex: { xs: '1', md: '0 0 33.333%' }, maxWidth: { xs: '100%', md: '33.333%' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon />
                  {translate('common.customer')}
                  {workOrder?.customer_id && (
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/customers/${workOrder.customer_id}`}
                      sx={{ ml: 'auto' }}
                    >
                      <InfoIcon />
                    </IconButton>
                  )}
                </Typography>
                <CustomerInfo customerId={workOrder.customer_id} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon />
                  {translate('common.machine')}
                  {workOrder?.machine_id && (
                    <IconButton
                      size="small"
                      component={Link}
                                                      to={`/machines/detail/${workOrder.machine_id}`}
                      sx={{ ml: 'auto' }}
                    >
                      <InfoIcon />
                    </IconButton>
                  )}
                </Typography>
                <MachineInfo machineId={workOrder.machine_id} workOrder={workOrder} />
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Work Order Details - Right Side (Wider) */}
        <Box sx={{ flex: { xs: '1', md: '0 0 66.667%' }, maxWidth: { xs: '100%', md: '66.667%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon />
                {translate('common.warrantyWorkOrderDetails')}
              </Typography>
              
              {/* Basic Details Section */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  {translate('common.basicInformation')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label={translate('common.description')}
                      value={form.description}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </Grid>
                  
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={translate('status.status')}
                      value={form.status}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <MenuItem value="pending">{translate('status.pending')}</MenuItem>
                      <MenuItem value="in_progress">{translate('status.inProgress')}</MenuItem>
                      <MenuItem value="completed">{translate('status.completed')}</MenuItem>
                      <MenuItem value="cancelled">{translate('status.cancelled')}</MenuItem>
                      <MenuItem value="testing">{translate('status.testing')}</MenuItem>
                      <MenuItem value="parts_ordered">{translate('status.partsOrdered')}</MenuItem>
                      <MenuItem value="waiting_approval">{translate('status.waitingApproval')}</MenuItem>
                      <MenuItem value="waiting_supplier">{translate('status.waitingSupplier')}</MenuItem>
                      <MenuItem value="service_cancelled">{translate('status.serviceCancelled')}</MenuItem>
                      <MenuItem value="warranty_rejected">{translate('status.warrantyRejected')}</MenuItem>
                    </TextField>
                  </Grid>
                  
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label={translate('status.priority')}
                      value={form.priority}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    >
                      <MenuItem value="low">{translate('status.low')}</MenuItem>
                      <MenuItem value="medium">{translate('status.medium')}</MenuItem>
                      <MenuItem value="high">{translate('status.high')}</MenuItem>
                    </TextField>
                  </Grid>
                  
                  <Grid xs={12} sm={12}>
                    <TextField
                      fullWidth
                      select
                      label={translate('forms.technician')}
                      value={form.technician_id || ''}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, technician_id: e.target.value }))}
                      displayEmpty
                      sx={{
                        '& .MuiSelect-select': {
                          minHeight: '1.4375em',
                          textAlign: 'left',
                        },
                        '& .MuiSelect-select[data-value=""]': {
                          color: 'text.secondary',
                        }
                      }}
                                             renderValue={(value) => {
                         if (!value || value === '') {
                           return translate('common.selectTechnician');
                         }
                         // First try to find in technicians list
                         const technician = techniciansQuery.data?.find(tech => tech.id === value);
                         if (technician) {
                           return technician.name;
                         }
                         // If not found in list, try to use the name from work order data
                         if (workOrder) {
                           if (value === workOrder.owner_technician_id && workOrder.owner_technician_name) {
                             return workOrder.owner_technician_name;
                           }
                           if (value === workOrder.technician_id && workOrder.technician_name) {
                             return workOrder.technician_name;
                           }
                         }
                         return translate('common.selectTechnician');
                       }}
                    >
                      <MenuItem value="">{translate('common.selectTechnician')}</MenuItem>
                      {techniciansQuery.data?.map((tech) => (
                        <MenuItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
              </Box>

              {/* Time and Schedule Section */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  {translate('common.timeAndSchedule')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
                      <DateTimePicker
                        label={translate('forms.startedAt')}
                        value={form.started_at ? new Date(form.started_at) : null}
                        disabled={true}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            InputProps: {
                              startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                            }
                          }
                        }}
                        format="dd.MM.yyyy HH:mm"
                      />
                    </LocalizationProvider>
                  </Grid>

                  <Grid xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
                      <DateTimePicker
                        label={translate('forms.completedAt')}
                        value={form.completed_at ? new Date(form.completed_at) : null}
                        disabled={true}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            InputProps: {
                              startAdornment: <CheckIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                            }
                          }
                        }}
                        format="dd.MM.yyyy HH:mm"
                      />
                    </LocalizationProvider>
                  </Grid>
                </Grid>
              </Box>

              {/* Cost Information Section */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  {translate('common.costInformationForReferenceOnly')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      step="0.01"
                      min="0"
                      label={translate('common.laborHours')}
                      value={form.labor_hours}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, labor_hours: e.target.value }))}
                      InputProps={{
                        startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      step="0.01"
                      min="0"
                      label={translate('common.laborRatePerHour')}
                      value={form.labor_rate}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, labor_rate: e.target.value }))}
                      InputProps={{
                        startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      step="0.01"
                      min="0"
                      label={translate('common.troubleshootingFee')}
                      value={form.troubleshooting_fee}
                      disabled={!isEditing}
                      onChange={(e) => setForm(f => ({ ...f, troubleshooting_fee: e.target.value }))}
                      helperText={translate('common.optionalForReferenceOnly')}
                      InputProps={{
                        startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      step="0.01"
                      min="0"
                      label={translate('common.partsSubtotal')}
                      value={form.quote_subtotal_parts}
                      disabled={true}
                      helperText={translate('common.autoCalculatedFromPartsUsed')}
                      InputProps={{
                        startAdornment: <InventoryIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Notes Section */}
              <Box sx={{ mb: 4 }}>
                                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                   <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                     <NoteIcon />
                     {translate('common.technicianNotes')}
                   </Typography>
                   {canEdit && isEditing && (
                     <Button
                       size="small"
                       startIcon={<AddIcon />}
                       onClick={() => setNoteDialogOpen(true)}
                     >
                       {translate('common.addNote')}
                     </Button>
                   )}
                 </Box>
                
                {notesQuery.isLoading ? (
                  <CircularProgress size={20} />
                ) : notesQuery.error ? (
                  <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                    {notesQuery.error.message}
                  </Alert>
                ) : (notesQuery.data || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {translate('common.noNotesYet')}
                  </Typography>
                ) : (
                  <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 1 }}>
                    {notesQuery.data.map((note) => (
                      <ListItem key={note.id} sx={{ px: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {note.content}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(note.created_at)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* Parts Used Section */}
              <Box sx={{ mb: 4 }}>
                                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                   <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                     <InventoryIcon />
                     {translate('common.partsUsed')}
                   </Typography>
                   {canEdit && isEditing && (
                     <Button
                       size="small"
                       startIcon={<AddIcon />}
                       onClick={() => setInventoryDialogOpen(true)}
                     >
                       {translate('common.addPart')}
                     </Button>
                   )}
                 </Box>
                
                {inventoryQuery.isLoading ? (
                  <CircularProgress size={20} />
                ) : inventoryQuery.error ? (
                  <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                    {inventoryQuery.error.message}
                  </Alert>
                ) : (inventoryQuery.data || []).length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {translate('common.noPartsUsedYet')}
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, bgcolor: 'primary.main', color: 'white' }}>{translate('common.partName')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'primary.main', color: 'white' }}>{translate('common.quantity')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'primary.main', color: 'white' }}>{translate('common.unitPrice')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'primary.main', color: 'white' }}>{translate('common.totalPrice')}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'primary.main', color: 'white' }}>{translate('common.actions')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventoryQuery.data.map((item, index) => (
                          <TableRow key={item.id} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'grey.50' } }}>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.inventory_name}
                                </Typography>
                                {item.inventory_description && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.inventory_description}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={item.quantity}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                ${(Number(item.unit_price) || 0).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                ${(Number(item.total_price) || 0).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title={translate('common.removePart')}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    // TODO: Add delete functionality
                                    console.log('Delete part:', item.id)
                                  }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              {/* Cost Summary - Warranty Version */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                  {translate('common.warrantyCostSummary')}
                </Typography>
                <Card variant="outlined" sx={{ bgcolor: 'success.light' }}>
                  <CardContent>
                    <Grid container spacing={3}>
                      <Grid xs={12} sm={6} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                          <TimeIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {translate('common.laborCost')}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                            ${((Number(form.labor_hours) || 0) * (Number(form.labor_rate) || 0)).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {form.labor_hours || 0} {translate('common.hours')} × ${form.labor_rate || 0}/{translate('common.hour')}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid xs={12} sm={6} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                          <InventoryIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {translate('common.partsCost')}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                            ${(Number(form.quote_subtotal_parts) || 0).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {inventoryQuery.data?.length || 0} {translate('common.partsUsedCount')}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid xs={12} sm={6} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                          <MoneyIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {translate('common.troubleshooting')}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                            ${(Number(form.troubleshooting_fee) || 0).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {translate('common.optionalFee')}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid xs={12} sm={6} md={3}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.main', borderRadius: 1, color: 'white' }}>
                          <SecurityIcon sx={{ fontSize: 32, color: 'white', mb: 1 }} />
                          <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
                            {translate('common.customerCost')}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            $0.00
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            {translate('common.warrantyCovered')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('common.deleteWarrantyWorkOrder')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('common.deleteWarrantyWorkOrderConfirmation')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteWorkOrder.mutate()
              setDeleteDialogOpen(false)
            }}
            disabled={deleteWorkOrder.isLoading}
          >
            {deleteWorkOrder.isLoading ? translate('common.deleting') : translate('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          {translate('common.addTechnicianNote')}
        </DialogTitle>
        <DialogContent>
          <Grid xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label={translate('common.noteContent')}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={translate('common.enterYourNoteHere')}
              sx={{ mt: 1 }}
            />
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={addNote.isLoading || !newNote.trim()}
          >
            {addNote.isLoading ? translate('common.adding') : translate('common.addNote')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onClose={() => setInventoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          {translate('common.addPartUsed')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid xs={12}>
              <TextField
                fullWidth
                select
                label={translate('forms.inventoryItem')}
                value={newInventory.inventory_id}
                onChange={(e) => setNewInventory(f => ({ ...f, inventory_id: e.target.value }))}
              >
                {allInventoryQuery.data?.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} - ${(Number(item.unit_price) || 0).toFixed(2)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid xs={12}>
              <TextField
                fullWidth
                type="number"
                min="1"
                label={translate('common.quantity')}
                value={newInventory.quantity}
                onChange={(e) => setNewInventory(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInventoryDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleAddInventory}
            disabled={addInventory.isLoading || !newInventory.inventory_id || !newInventory.quantity}
          >
            {addInventory.isLoading ? translate('common.adding') : translate('common.addPart')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
