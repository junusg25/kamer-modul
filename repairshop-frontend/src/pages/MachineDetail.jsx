import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import api from '../services/api'
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
  Fab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
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
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Check as CheckIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  LocalShipping as ShippingIcon,
  Inventory as InventoryIcon,
  Assessment as AssessmentIcon,
  Notes as NotesIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'

export default function MachineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { translate, formatDate, formatDateForInput } = useLanguage()
  const [activeTab, setActiveTab] = React.useState(0)

  const machineQuery = useQuery({
    queryKey: ['machine', id],
    queryFn: async () => (await api.get(`/machines/${id}`)).data.data,
  })

  const workOrdersQuery = useQuery({
    queryKey: ['machine-work-orders', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/workOrders`, { params: { machine_id: id } })).data.data,
  })

  const repairTicketsQuery = useQuery({
    queryKey: ['machine-repair-tickets', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/repairTickets`, { params: { machine_id: id } })).data.data,
  })

  const updateMachine = useMutation({
    mutationFn: (updates) => api.patch(`/machines/${id}`, updates).then(r => r.data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['machine', id] }); 
      toast.success(translate('notifications.machineUpdated')) 
    },
  })

  const deleteMachine = useMutation({
    mutationFn: () => api.delete(`/machines/${id}`).then(r => r.data),
    onSuccess: () => { toast.success(translate('notifications.machineDeleted')); navigate('/machines') },
    onError: (e) => toast.error(e?.response?.data?.message || translate('errors.deleteFailed'))
  })

  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ 
    customer_id: '', 
    name: '', 
    model_name: '',
    catalogue_number: '', 
    serial_number: '', 
    description: '',
    manufacturer: '',
    bought_at: '',
    category_id: '',
    receipt_number: '',
    purchase_date: ''
  })

  React.useEffect(() => {
    if (machineQuery.data) {
      const machine = machineQuery.data
      setForm({
        customer_id: machine.customer_id || '',
        name: machine.name || '',
        model_name: machine.model_name || '',
        catalogue_number: machine.catalogue_number || '',
        serial_number: machine.serial_number || '',
        description: machine.description || '',
        manufacturer: machine.manufacturer || '',
        bought_at: machine.bought_at || '',
        category_id: machine.category_id || '',
        receipt_number: machine.receipt_number || '',
        purchase_date: machine.purchase_date || ''
      })
    }
  }, [machineQuery.data])

  if (machineQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (machineQuery.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{machineQuery.error.message}</Alert>
      </Box>
    )
  }

  const machine = machineQuery.data

  const onSave = () => {
    updateMachine.mutate({
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      name: form.name,
      model_name: form.model_name || null,
      catalogue_number: form.catalogue_number || null,
      serial_number: form.serial_number || null,
      description: form.description || null,
      manufacturer: form.manufacturer || null,
      bought_at: form.bought_at || null,
      category_id: form.category_id || null,
      receipt_number: form.receipt_number || null,
      purchase_date: form.purchase_date || null,
    }, { onSuccess: () => setIsEditing(false) })
  }

  const onCancel = () => {
    setIsEditing(false)
    setForm({
      customer_id: machine.customer_id || '',
      name: machine.name || '',
      model_name: machine.model_name || '',
      catalogue_number: machine.catalogue_number || '',
      serial_number: machine.serial_number || '',
      description: machine.description || '',
      manufacturer: machine.manufacturer || '',
      bought_at: machine.bought_at || '',
      category_id: machine.category_id || '',
      receipt_number: machine.receipt_number || '',
      purchase_date: machine.purchase_date || ''
    })
  }

  const getWarrantyStatus = () => {
    // Check for repair tickets with warranty first
    const warrantyRepairTicket = repairTicketsQuery.data?.find(rt => rt.is_warranty)
    if (warrantyRepairTicket) {
      return { 
        status: translate('common.warrantyActiveRepairTicket', { id: warrantyRepairTicket.id }), 
        color: 'success' 
      }
    }
    
    // Check for work orders with warranty
    const warrantyWorkOrder = workOrdersQuery.data?.find(wo => wo.is_warranty)
    if (warrantyWorkOrder) {
      return { 
        status: translate('common.warrantyActiveWorkOrder', { id: warrantyWorkOrder.id }), 
        color: 'success' 
      }
    }
    
    // Fallback to machine's warranty_expiry_date if no active warranty found
    if (!machine.warranty_expiry_date) return { status: translate('common.noWarranty'), color: 'default' }
    const expiryDate = new Date(machine.warranty_expiry_date)
    const today = new Date()
    if (expiryDate > today) {
      const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
      return { 
        status: translate('common.warrantyActiveDaysLeft', { days: daysLeft }), 
        color: daysLeft <= 30 ? 'warning' : 'success' 
      }
    } else {
      return { status: translate('common.warrantyExpired'), color: 'error' }
    }
  }

  const warrantyStatus = getWarrantyStatus()

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
              <BuildIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                {machine.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {translate('common.machine')} #{machine.id}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isEditing ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsEditing(true)}
            >
              {translate('common.edit')}
            </Button>
          ) : (
            <>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={onCancel}>
                {translate('common.cancel')}
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateMachine.isLoading}
                onClick={onSave}
              >
                {updateMachine.isLoading ? translate('common.saving') : translate('common.save')}
              </Button>
            </>
          )}
          
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {translate('common.delete')}
          </Button>
        </Box>
      </Box>

      {/* Quick Status Overview */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.warrantyStatus')}
              </Typography>
              <Chip
                label={warrantyStatus.status}
                color={warrantyStatus.color}
                size="large"
                sx={{ fontSize: '1rem', py: 1 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.totalWorkOrders')}
              </Typography>
              <Chip
                label={workOrdersQuery.data?.length || 0}
                color="primary"
                size="large"
                sx={{ fontSize: '1rem', py: 1 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.created')}
              </Typography>
              <Typography variant="h6">
                {formatDate(machine.created_at)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabbed Content */}
      <Paper elevation={1} sx={{ borderRadius: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={translate('common.machineDetails')} 
            icon={<BuildIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={translate('common.workOrders')} 
            icon={<AssignmentIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={translate('common.statistics')} 
            icon={<InfoIcon />} 
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Machine Details Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BuildIcon />
                      {translate('common.machineDetails')}
                    </Typography>
                    
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <BuildIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            isEditing ? (
                              <TextField
                                fullWidth
                                size="small"
                                value={form.name}
                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                              />
                            ) : (
                              machine.name
                            )
                          }
                          secondary={translate('common.machineName')}
                        />
                      </ListItem>
                      
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InfoIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            isEditing ? (
                              <TextField
                                fullWidth
                                size="small"
                                value={form.model_name}
                                onChange={(e) => setForm(f => ({ ...f, model_name: e.target.value }))}
                              />
                            ) : (
                              machine.model_name || translate('common.notProvided')
                            )
                          }
                          secondary={translate('forms.modelName')}
                        />
                      </ListItem>
                      
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InfoIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            isEditing ? (
                              <TextField
                                fullWidth
                                size="small"
                                value={form.catalogue_number}
                                onChange={(e) => setForm(f => ({ ...f, catalogue_number: e.target.value }))}
                              />
                            ) : (
                              machine.catalogue_number || translate('common.notProvided')
                            )
                          }
                          secondary={translate('common.catalogueNumber')}
                        />
                      </ListItem>
                      
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            isEditing ? (
                              <TextField
                                fullWidth
                                size="small"
                                value={form.serial_number}
                                onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))}
                              />
                            ) : (
                              machine.serial_number || translate('common.notProvided')
                            )
                          }
                          secondary={translate('common.serialNumber')}
                        />
                      </ListItem>
                      
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <DescriptionIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            isEditing ? (
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                              />
                            ) : (
                              <Typography
                                sx={{
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word',
                                  lineHeight: 1.4
                                }}
                              >
                                {machine.description || translate('common.noDescription')}
                              </Typography>
                            )
                          }
                          secondary={translate('common.description')}
                        />
                      </ListItem>
                      
                      {machine.manufacturer && (
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <BuildIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              isEditing ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={form.manufacturer}
                                  onChange={(e) => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                                />
                              ) : (
                                machine.manufacturer
                              )
                            }
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
                            primary={
                              isEditing ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={form.bought_at}
                                  onChange={(e) => setForm(f => ({ ...f, bought_at: e.target.value }))}
                                />
                              ) : (
                                machine.bought_at
                              )
                            }
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
                            primary={
                              isEditing ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={form.receipt_number}
                                  onChange={(e) => setForm(f => ({ ...f, receipt_number: e.target.value }))}
                                />
                              ) : (
                                machine.receipt_number
                              )
                            }
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
                            primary={
                              isEditing ? (
                                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
                                  <DatePicker
                                    value={form.purchase_date ? new Date(form.purchase_date) : null}
                                    onChange={(newValue) => setForm(f => ({ ...f, purchase_date: newValue ? newValue.toISOString() : '' }))}
                                    slotProps={{
                                      textField: {
                                        fullWidth: true,
                                        size: 'small'
                                      }
                                    }}
                                    format="dd.MM.yyyy"
                                  />
                                </LocalizationProvider>
                              ) : (
                                formatDate(machine.purchase_date)
                              )
                            }
                            secondary={translate('forms.purchaseDate')}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} lg={6}>
                {/* Customer Information */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon />
                      {translate('common.customer')}
                      {machine?.customer_id && (
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/customers/${machine.customer_id}`}
                          sx={{ ml: 'auto' }}
                        >
                          <LinkIcon />
                        </IconButton>
                      )}
                    </Typography>
                    <CustomerInfo customerId={machine.customer_id} />
                  </CardContent>
                </Card>

                {/* Warranty Information */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon />
                      {translate('common.warrantyStatus')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Chip
                        label={warrantyStatus.status}
                        color={warrantyStatus.color}
                        variant="filled"
                        size="medium"
                      />
                      
                      {machine.warranty_expiry_date && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.expiryDate')}
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(machine.warranty_expiry_date)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Work Orders Tab */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon />
                  {translate('common.workOrders')} ({workOrdersQuery.data?.length || 0})
                </Typography>
                <Chip
                  label={`${workOrdersQuery.data?.length || 0} ${translate('common.workOrdersCount')}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>
              
              {workOrdersQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : workOrdersQuery.error ? (
                <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                  {workOrdersQuery.error.message}
                </Alert>
              ) : (workOrdersQuery.data || []).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {translate('common.noWorkOrdersFound')}
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{translate('tableHeaders.id')}</TableCell>
                        <TableCell>{translate('common.type')}</TableCell>
                        <TableCell>{translate('tableHeaders.status')}</TableCell>
                        <TableCell>{translate('tableHeaders.priority')}</TableCell>
                        <TableCell>{translate('common.created')}</TableCell>
                        <TableCell>{translate('common.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {workOrdersQuery.data.map((workOrder) => (
                        <TableRow key={workOrder.id} hover>
                          <TableCell>
                            <Button
                              component={Link}
                              to={`/work-orders/${workOrder.id}`}
                              size="small"
                              sx={{ minWidth: 'auto', p: 0 }}
                            >
                              #{workOrder.id}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={workOrder.status === 'intake' ? <TicketIcon /> : <AssignmentIcon />}
                              label={workOrder.status === 'intake' ? translate('common.ticket') : translate('common.workOrder')}
                              size="small"
                              color={workOrder.status === 'intake' ? 'default' : 'primary'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={workOrder.status.replace('_', ' ')}
                              size="small"
                              color={
                                workOrder.status === 'completed' ? 'success' :
                                workOrder.status === 'in_progress' ? 'info' :
                                workOrder.status === 'pending' ? 'warning' :
                                'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={workOrder.priority}
                              size="small"
                              color={
                                workOrder.priority === 'high' ? 'error' :
                                workOrder.priority === 'medium' ? 'warning' :
                                'success'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {formatDate(workOrder.created_at)}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={translate('common.viewDetails')}>
                              <IconButton
                                size="small"
                                component={Link}
                                to={`/work-orders/${workOrder.id}`}
                              >
                                <InfoIcon fontSize="small" />
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
          )}

          {/* Statistics Tab */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon />
                      {translate('common.statistics')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {translate('common.totalWorkOrders')}
                        </Typography>
                        <Chip
                          label={workOrdersQuery.data?.length || 0}
                          color="primary"
                          size="small"
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {translate('common.created')}
                        </Typography>
                        <Typography variant="body2">
                          {formatDate(machine.created_at)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {translate('common.lastUpdated')}
                        </Typography>
                        <Typography variant="body2">
                          {formatDate(machine.updated_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssessmentIcon />
                      {translate('common.warrantyOverview')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {translate('common.warrantyStatus')}
                        </Typography>
                        <Chip
                          label={warrantyStatus.status}
                          color={warrantyStatus.color}
                          size="small"
                        />
                      </Box>
                      
                      {machine.warranty_expiry_date && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.expiryDate')}
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(machine.warranty_expiry_date)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('common.deleteMachine')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('common.deleteMachineConfirmation', { name: machine.name })}
          </Typography>
          {workOrdersQuery.data?.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {translate('common.machineHasWorkOrdersWarning', { count: workOrdersQuery.data.length })}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteMachine.mutate()
              setDeleteDialogOpen(false)
            }}
            disabled={deleteMachine.isLoading}
          >
            {deleteMachine.isLoading ? translate('common.deleting') : translate('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function CustomerInfo({ customerId }) {
  const { translate, formatDate, formatDateForInput } = useLanguage()
  const customerQuery = useQuery({
    queryKey: ['customer', customerId],
    enabled: !!customerId,
    queryFn: async () => (await api.get(`/customers/${customerId}`)).data.data,
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
    </List>
  )
}
