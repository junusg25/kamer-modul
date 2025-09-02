import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import api from '../services/api'
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Stack,
  Avatar,
  Paper,
  Container,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  Build as BuildIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Category as CategoryIcon,
  DateRange as DateIcon,
  Receipt as ReceiptIcon,
  Description as DescriptionIcon,
  BuildCircle as BuildCircleIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateDashboardCache, invalidateWarrantyRepairTicketsCache, invalidateWarrantyWorkOrdersCache } from '../utils/cacheUtils.js'

export default function WarrantyTicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { translate, formatDate, formatTime, formatDateTime } = useLanguage()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [convertModalOpen, setConvertModalOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(0)
  const [convertForm, setConvertForm] = React.useState({
    technician_id: '',
    priority: 'medium',
  })

  // Initialize convert form when modal opens
  React.useEffect(() => {
    if (convertModalOpen) {
      setConvertForm({
        technician_id: (user?.role === 'admin' || user?.role === 'manager') ? '' : user?.id || '',
        priority: 'medium',
      });
    }
  }, [convertModalOpen, user]);

  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'

  const ticket = useQuery({
    queryKey: ['warrantyRepairTicket', id],
    queryFn: async () => (await api.get(`/warrantyRepairTickets/${id}`)).data.data,
    enabled: !!id,
  })

  const technicians = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      try {
        const response = await api.get('/users/technicians')
        return response.data.data || []
      } catch (error) {
        console.error('Error fetching technicians:', error)
        return []
      }
    },
  })

  const updateTicket = useMutation({
    mutationFn: (updates) => api.patch(`/warrantyRepairTickets/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warrantyRepairTicket', id] })
      queryClient.invalidateQueries({ queryKey: ['warranty-repair-tickets'] })
      toast.success(translate('notifications.warrantyRepairTicketUpdated'))
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToUpdateWarrantyRepairTicket'))
    },
  })

  const deleteTicket = useMutation({
    mutationFn: () => api.delete(`/warrantyRepairTickets/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets'
      });
      await queryClient.refetchQueries({
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets'
      });
      toast.success(translate('notifications.warrantyRepairTicketDeleted'))
      navigate('/warranty')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteWarrantyRepairTicket'))
    },
  })

  const convertToWarrantyWorkOrder = useMutation({
    mutationFn: (data) => api.post(`/warrantyRepairTickets/${id}/convert`, data),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['warrantyRepairTicket', id] });
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
      });
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'warranty-work-orders' 
      });
      await Promise.all([
        invalidateDashboardCache(queryClient),
        invalidateWarrantyRepairTicketsCache(queryClient),
        invalidateWarrantyWorkOrdersCache(queryClient)
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['warrantyRepairTicket', id] }),
        queryClient.refetchQueries({ 
          predicate: (query) => query.queryKey[0] === 'warranty-repair-tickets' 
        }),
        queryClient.refetchQueries({ 
          predicate: (query) => query.queryKey[0] === 'warranty-work-orders' 
        })
      ]);
      toast.success(translate('notifications.warrantyRepairTicketConverted'))
      setConvertModalOpen(false)
      if (response.data?.data?.warranty_work_order?.id) {
        navigate(`/warranty-work-orders/${response.data.data.warranty_work_order.id}`)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToConvertWarrantyRepairTicket'))
    },
  })

  const [form, setForm] = React.useState({
    problem_description: '',
    notes: '',
    additional_equipment: '',
    brought_by: '',
  })

  React.useEffect(() => {
    if (ticket.data) {
      setForm({
        problem_description: ticket.data.problem_description || '',
        notes: ticket.data.notes || '',
        additional_equipment: ticket.data.additional_equipment || '',
        brought_by: ticket.data.brought_by || '',
      })
    }
  }, [ticket.data])

  const handleSave = () => {
    const updates = {}
    if (form.problem_description !== ticket.data.problem_description) updates.problem_description = form.problem_description
    if (form.notes !== ticket.data.notes) updates.notes = form.notes
    if (form.additional_equipment !== ticket.data.additional_equipment) updates.additional_equipment = form.additional_equipment
    if (form.brought_by !== ticket.data.brought_by) updates.brought_by = form.brought_by

    if (Object.keys(updates).length > 0) {
      updateTicket.mutate(updates)
    } else {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setForm({
      problem_description: ticket.data.problem_description || '',
      notes: ticket.data.notes || '',
      additional_equipment: ticket.data.additional_equipment || '',
      brought_by: ticket.data.brought_by || '',
    })
    setIsEditing(false)
  }

  const handleConvertToWarrantyWorkOrder = () => {
    convertToWarrantyWorkOrder.mutate(convertForm)
  }

  const canEditTicket = () => {
    if (!ticket.data) return false
    return isAdmin || isManager || ticket.data.submitted_by === user?.id
  }

  const canDeleteTicket = () => {
    if (!ticket.data) return false
    return isAdmin || isManager || ticket.data.submitted_by === user?.id
  }

  const canConvertTicket = () => {
    return (isAdmin || isManager || user?.role === 'technician') && ticket.data?.status === 'intake'
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'intake': return translate('status.intake')
      case 'converted': return translate('status.converted')
      case 'cancelled': return translate('status.cancelled')
      default: return status.replace('_', ' ')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'intake': return 'warning'
      case 'converted': return 'success'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  if (ticket.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    )
  }

  if (ticket.error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ fontSize: '1.1rem', py: 2 }}>
          {ticket.error.message}
        </Alert>
      </Container>
    )
  }

  if (!ticket.data) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ fontSize: '1.1rem', py: 2 }}>
          {translate('errors.failedToLoadData')}
        </Alert>
      </Container>
    )
  }

  const data = ticket.data

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/warranty')} sx={{ color: 'primary.main' }}>
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
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                {translate('navigation.warrantyTickets')} {data.formatted_number || `#${data.ticket_number || data.id}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {translate('common.warranty')} • {getStatusLabel(data.status)} • {formatDate(data.created_at)}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEditTicket() && !isEditing && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsEditing(true)}
            >
              {translate('actions.edit')}
            </Button>
          )}
          {canConvertTicket() && (
            <Button
              variant="contained"
              startIcon={<BuildIcon />}
              onClick={() => setConvertModalOpen(true)}
              sx={{ 
                bgcolor: 'success.main',
                '&:hover': { bgcolor: 'success.dark' }
              }}
            >
              {translate('actions.convertToWarrantyWorkOrder')}
            </Button>
          )}
          {canDeleteTicket() && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {translate('actions.delete')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Quick Status Overview */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('tableHeaders.status')}
              </Typography>
              <Chip
                label={getStatusLabel(data.status)}
                color={getStatusColor(data.status)}
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
                {formatDate(data.created_at)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.lastUpdated')}
              </Typography>
              <Typography variant="h6">
                {formatDate(data.updated_at)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.warranty')}
              </Typography>
              <Chip
                label={data.warranty_expiry_date && new Date(data.warranty_expiry_date) > new Date() ? translate('status.underWarranty') : translate('status.expired')}
                color={data.warranty_expiry_date && new Date(data.warranty_expiry_date) > new Date() ? 'success' : 'error'}
                size="large"
                sx={{ fontSize: '1rem', py: 1 }}
              />
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
            label={translate('common.customerInformation')} 
            icon={<PersonIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={translate('common.machineInformation')} 
            icon={<BuildCircleIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={translate('common.ticketDetails')} 
            icon={<DescriptionIcon />} 
            iconPosition="start"
          />
          {data.status === 'converted' && data.converted_to_warranty_work_order_id && (
            <Tab 
              label={translate('common.conversionInformation')} 
              icon={<BuildIcon />} 
              iconPosition="start"
            />
          )}
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Customer Information Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        data.customer_id ? (
                          <Button
                            component={Link}
                            to={`/customers/${data.customer_id}`}
                            size="large"
                            sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                          >
                            {data.customer_name || translate('common.notSpecified')}
                          </Button>
                        ) : (
                          data.customer_name || translate('common.notSpecified')
                        )
                      }
                      secondary={translate('forms.customerName')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  {data.company_name && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <BusinessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.company_name}
                        secondary={translate('forms.companyName')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <PhoneIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.phone1 || translate('common.notSpecified')}
                      secondary={translate('forms.primaryPhone')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  {data.phone2 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <PhoneIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.phone2}
                        secondary={translate('forms.secondaryPhone')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <EmailIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.email || translate('common.notSpecified')}
                      secondary={translate('common.emailAddress')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  {(data.street_address || data.city || data.postal_code) && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <LocationIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={[data.street_address, data.city, data.postal_code].filter(Boolean).join(', ') || translate('common.notSpecified')}
                        secondary={translate('forms.address')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  {data.vat_number && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <ReceiptIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.vat_number}
                        secondary={translate('forms.vatNumber')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}

          {/* Machine Information Tab */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <BuildCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        data.machine_id ? (
                                                     <Button
                             component={Link}
                             to={`/machines/detail/${data.machine_id}`}
                             size="large"
                             sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                           >
                            {data.model_name || translate('common.notSpecified')}
                          </Button>
                        ) : (
                          data.model_name || translate('common.notSpecified')
                        )
                      }
                      secondary={translate('forms.modelName')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  {data.manufacturer && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <BusinessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.manufacturer}
                        secondary={translate('forms.manufacturer')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  {data.model_description && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <InfoIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.model_description}
                        secondary={translate('forms.modelDescription')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <ReceiptIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.serial_number || translate('common.notSpecified')}
                      secondary={translate('forms.serialNumber')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <List>
                  {data.category_name && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <CategoryIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.category_name}
                        secondary={translate('forms.category')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  {data.purchase_date && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <DateIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={formatDate(data.purchase_date)}
                        secondary={translate('forms.purchaseDate')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  {data.bought_at && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <BusinessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.bought_at}
                        secondary={translate('common.boughtAt')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                  
                  {data.receipt_number && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <ReceiptIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={data.receipt_number}
                        secondary={translate('forms.receiptNumber')}
                        primaryTypographyProps={{ variant: 'h6' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}

          {/* Ticket Details Tab */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <DescriptionIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={form.problem_description}
                            onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
                            size="medium"
                            variant="outlined"
                          />
                        ) : (
                          <Typography 
                            variant="h6"
                            sx={{
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              lineHeight: 1.4
                            }}
                          >
                            {data.problem_description || translate('common.notSpecified')}
                          </Typography>
                        )
                      }
                      secondary={translate('forms.problemDescription')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <InfoIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            size="medium"
                            variant="outlined"
                            placeholder={translate('forms.additionalNotes')}
                          />
                        ) : (
                          <Typography 
                            variant="h6"
                            sx={{
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              lineHeight: 1.4
                            }}
                          >
                            {data.notes || translate('common.noNotes')}
                          </Typography>
                        )
                      }
                      secondary={translate('forms.notes')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <BuildIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            value={form.additional_equipment}
                            onChange={(e) => setForm({ ...form, additional_equipment: e.target.value })}
                            size="medium"
                            variant="outlined"
                            placeholder={translate('forms.additionalEquipmentBrought')}
                          />
                        ) : (
                          <Typography variant="h6">
                            {data.additional_equipment || translate('common.none')}
                          </Typography>
                        )
                      }
                      secondary={translate('forms.additionalEquipment')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            value={form.brought_by}
                            onChange={(e) => setForm({ ...form, brought_by: e.target.value })}
                            size="medium"
                            variant="outlined"
                            placeholder={translate('forms.personWhoBrought')}
                          />
                        ) : (
                          <Typography variant="h6">
                            {data.brought_by || translate('common.notSpecified')}
                          </Typography>
                        )
                      }
                      secondary={translate('forms.broughtBy')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <AssignmentIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.submitted_by_name || translate('common.unknown')}
                      secondary={translate('forms.submittedBy')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                </List>

                {/* Edit/Save/Cancel buttons */}
                {canEditTicket() && (
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    {isEditing ? (
                      <>
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={handleSave}
                          size="large"
                          disabled={updateTicket.isLoading}
                        >
                          {updateTicket.isLoading ? translate('common.saving') : translate('actions.save')}
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={handleCancel}
                          size="large"
                        >
                          {translate('actions.cancel')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setIsEditing(true)}
                        size="large"
                      >
                        {translate('common.editTicketDetails')}
                      </Button>
                    )}
                  </Box>
                )}
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {translate('common.ticketSummary')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('tableHeaders.status')}
                      </Typography>
                      <Chip
                        label={getStatusLabel(data.status)}
                        color={getStatusColor(data.status)}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.created')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(data.created_at)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.lastUpdated')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(data.updated_at)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Conversion Information Tab */}
          {activeTab === 3 && data.status === 'converted' && data.converted_to_warranty_work_order_id && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <BuildIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Button
                          component={Link}
                          to={`/warranty-work-orders/${data.converted_to_warranty_work_order_id}`}
                          size="large"
                          sx={{ textTransform: 'none' }}
                        >
                          {data.converted_warranty_work_order_formatted_number || `#${data.converted_to_warranty_work_order_id}`}
                        </Button>
                      }
                      secondary={translate('common.convertedToWorkOrder')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.converted_by_technician_name || translate('common.unknown')}
                      secondary={translate('common.convertedBy')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <ScheduleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={data.converted_at ? formatDateTime(data.converted_at) : formatDateTime(data.updated_at)}
                      secondary={translate('common.convertedAt')}
                      primaryTypographyProps={{ variant: 'h6' }}
                    />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {translate('common.conversionSummary')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.status')}
                      </Typography>
                      <Chip
                        label={translate('status.converted')}
                        color="success"
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.workOrder')}
                      </Typography>
                      <Typography variant="body2">
                        {data.converted_warranty_work_order_formatted_number || `#${data.converted_to_warranty_work_order_id}`}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Convert to Warranty Work Order Modal */}
      <Dialog 
        open={convertModalOpen} 
        onClose={() => setConvertModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {translate('dialogs.convertToWarrantyWorkOrder')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info">
                {(user?.role === 'admin' || user?.role === 'manager') 
                  ? translate('dialogs.convertToWarrantyWorkOrderConfirmationManagerAdmin')
                  : translate('dialogs.convertToWarrantyWorkOrderConfirmation')
                }
              </Alert>
            </Grid>
            <Grid item xs={12} md={6}>
              {(user?.role === 'admin' || user?.role === 'manager') ? (
                <FormControl fullWidth sx={{ minHeight: '56px' }}>
                  <InputLabel 
                    sx={{ 
                      backgroundColor: 'background.paper',
                      px: 1,
                      '&.Mui-focused': {
                        backgroundColor: 'background.paper',
                        px: 1
                      }
                    }}
                  >
                    {translate('forms.assignedTechnician')}
                  </InputLabel>
                  <Select
                    value={convertForm.technician_id}
                    onChange={(e) => setConvertForm({...convertForm, technician_id: e.target.value})}
                    label={translate('forms.assignedTechnician')}
                    disabled={technicians.isLoading}
                    SelectDisplayProps={{
                      style: { paddingRight: '180px' }
                    }}
                    sx={{ 
                      minHeight: '56px',
                      '& .MuiSelect-select': {
                        paddingTop: '16px',
                        paddingBottom: '16px'
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>{translate('common.unassigned')}</em>
                    </MenuItem>
                    {technicians.data?.map((tech) => (
                      <MenuItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {technicians.isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      <Typography variant="caption" color="textSecondary">
                        {translate('common.loadingTechnicians')}
                      </Typography>
                    </Box>
                  )}
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label={translate('forms.assignedTechnician')}
                  value={user?.name || translate('common.currentUser')}
                  disabled
                  sx={{ 
                    minHeight: '56px',
                    '& .MuiInputBase-root': {
                      minHeight: '56px'
                    }
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{translate('tableHeaders.priority')}</InputLabel>
                <Select
                  value={convertForm.priority}
                  onChange={(e) => setConvertForm({...convertForm, priority: e.target.value})}
                  label={translate('tableHeaders.priority')}
                >
                  <MenuItem value="low">{translate('status.low')}</MenuItem>
                  <MenuItem value="medium">{translate('status.medium')}</MenuItem>
                  <MenuItem value="high">{translate('status.high')}</MenuItem>
                  <MenuItem value="urgent">{translate('status.urgent')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertModalOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={handleConvertToWarrantyWorkOrder}
            variant="contained"
            disabled={convertToWarrantyWorkOrder.isLoading}
            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
          >
            {convertToWarrantyWorkOrder.isLoading ? <CircularProgress size={24} /> : translate('actions.convert')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('dialogs.deleteWarrantyRepairTicket')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteWarrantyRepairTicketConfirmationWithId', { id: data.ticket_number || data.id })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={() => deleteTicket.mutate()} 
            color="error" 
            variant="contained"
            disabled={deleteTicket.isLoading}
          >
            {deleteTicket.isLoading ? translate('common.deleting') : translate('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
