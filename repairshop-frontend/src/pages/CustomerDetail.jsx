import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
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
  Badge,
  Tabs,
  Tab,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  CalendarToday as CalendarIcon,
  Update as UpdateIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  Engineering as EngineeringIcon,
  Settings as SettingsIcon,
  Receipt as ReceiptIcon,
  Fax as FaxIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  BuildCircle as BuildCircleIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  TrendingUp as SalesIcon,
  AttachMoney as MoneyIcon,
  Store as StoreIcon,
  Star as OpportunityIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { translate, formatDate } = useLanguage()
  const [activeTab, setActiveTab] = React.useState(0)

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data.data,
  })

  const machinesQuery = useQuery({
    queryKey: ['customer-machines', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/machines/by-customer/${id}`)).data.data,
  })

  const updateCustomer = useMutation({
    mutationFn: (updates) => api.patch(`/customers/${id}`, updates).then(r => r.data),
          onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['customer', id] }); 
        toast.success(translate('notifications.customerUpdated')) 
      },
  })

  const deleteCustomer = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`).then(r => r.data),
    onSuccess: () => { toast.success(translate('notifications.customerDeleted')); navigate('/customers') },
    onError: (e) => toast.error(e?.response?.data?.message || translate('errors.deleteFailed'))
  })

  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ 
    name: '', 
    email: '', 
    phone: '', 
    phone2: '',
    fax: '',
    company_name: '',
    vat_number: '',
    city: '',
    postal_code: '',
    street_address: ''
  })

  React.useEffect(() => {
    if (customerQuery.data) {
      const customer = customerQuery.data
      setForm({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        phone2: customer.phone2 || '',
        fax: customer.fax || '',
        company_name: customer.company_name || '',
        vat_number: customer.vat_number || '',
        city: customer.city || '',
        postal_code: customer.postal_code || '',
        street_address: customer.street_address || ''
      })
    }
  }, [customerQuery.data])

  if (customerQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (customerQuery.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{customerQuery.error.message}</Alert>
      </Box>
    )
  }

  const customer = customerQuery.data

  const onSave = () => {
    updateCustomer.mutate(form, { onSuccess: () => setIsEditing(false) })
  }

  const onCancel = () => {
    setIsEditing(false)
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      fax: customer.fax || '',
      company_name: customer.company_name || '',
      vat_number: customer.vat_number || '',
      city: customer.city || '',
      postal_code: customer.postal_code || '',
      street_address: customer.street_address || ''
    })
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
              {getInitials(customer.name)}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                {customer.name}
              </Typography>
                              <Typography variant="body2" color="text.secondary">
                  {translate('common.customer')} #{customer.id}
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
                onClick={() => navigate(`/unified-customer/${id}`)}
              >
                Unified Edit
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setIsEditing(true)}
              >
                {translate('common.edit')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={onCancel}>
                {translate('common.cancel')}
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateCustomer.isLoading}
                onClick={onSave}
              >
                {updateCustomer.isLoading ? translate('common.saving') : translate('common.save')}
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
                {translate('common.totalMachines')}
              </Typography>
              <Chip
                label={machinesQuery.data?.length || 0}
                color="primary"
                size="large"
                sx={{ fontSize: '1rem', py: 1 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.memberSince')}
              </Typography>
              <Typography variant="h6">
                {formatDate(customer.created_at)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.lastUpdated')}
              </Typography>
              <Typography variant="h6">
                {formatDate(customer.updated_at)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.status')}
              </Typography>
              <Chip
                label={machinesQuery.data?.length > 0 ? translate('common.active') : translate('common.noMachines')}
                color={machinesQuery.data?.length > 0 ? 'success' : 'default'}
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
            label={translate('common.contactInformation')} 
            icon={<PersonIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={translate('common.machines')} 
            icon={<BuildIcon />} 
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
          {/* Contact Information Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <PersonIcon fontSize="small" />
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
                          customer.name
                        )
                      }
                      secondary={translate('common.fullName')}
                    />
                  </ListItem>
                  
                  {customer.company_name && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <BusinessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.company_name}
                              onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                            />
                          ) : (
                            customer.company_name
                          )
                        }
                        secondary={translate('forms.companyName')}
                      />
                    </ListItem>
                  )}
                  
                  {customer.vat_number && (
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
                              value={form.vat_number}
                              onChange={(e) => setForm(f => ({ ...f, vat_number: e.target.value }))}
                            />
                          ) : (
                            customer.vat_number
                          )
                        }
                        secondary={translate('forms.vatNumber')}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <EmailIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          />
                        ) : (
                          customer.email || translate('common.notProvided')
                        )
                      }
                      secondary={translate('common.emailAddress')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <PhoneIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={form.phone}
                            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                          />
                        ) : (
                          customer.phone || translate('common.notProvided')
                        )
                      }
                      secondary={translate('forms.phone1')}
                    />
                  </ListItem>
                  
                  {customer.phone2 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <PhoneIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.phone2}
                              onChange={(e) => setForm(f => ({ ...f, phone2: e.target.value }))}
                            />
                          ) : (
                            customer.phone2
                          )
                        }
                        secondary={translate('forms.phone2')}
                      />
                    </ListItem>
                  )}
                  
                  {customer.fax && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <FaxIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.fax}
                              onChange={(e) => setForm(f => ({ ...f, fax: e.target.value }))}
                            />
                          ) : (
                            customer.fax
                          )
                        }
                        secondary={translate('forms.fax')}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <List>
                  {customer.city && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <LocationOnIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.city}
                              onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                            />
                          ) : (
                            customer.city
                          )
                        }
                        secondary={translate('forms.city')}
                      />
                    </ListItem>
                  )}
                  
                  {customer.postal_code && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <LocationOnIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.postal_code}
                              onChange={(e) => setForm(f => ({ ...f, postal_code: e.target.value }))}
                            />
                          ) : (
                            customer.postal_code
                          )
                        }
                        secondary={translate('forms.postalCode')}
                      />
                    </ListItem>
                  )}
                  
                  {customer.street_address && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <LocationOnIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              value={form.street_address}
                              onChange={(e) => setForm(f => ({ ...f, street_address: e.target.value }))}
                            />
                          ) : (
                            customer.street_address
                          )
                        }
                        secondary={translate('forms.streetAddress')}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}

          {/* Machines Tab */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon />
                  {translate('common.machines')} ({machinesQuery.data?.length || 0})
                </Typography>
                <Chip
                  label={`${machinesQuery.data?.length || 0} ${translate('common.machinesCount')}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>
              
              {machinesQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : machinesQuery.error ? (
                <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                  {machinesQuery.error.message}
                </Alert>
              ) : (machinesQuery.data || []).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <EngineeringIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {translate('common.noMachinesFound')}
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{translate('tableHeaders.id')}</TableCell>
                        <TableCell>{translate('common.model')}</TableCell>
                        <TableCell>{translate('common.catalogueNumber')}</TableCell>
                        <TableCell>{translate('common.serialNumber')}</TableCell>
                        <TableCell>{translate('forms.transactionType')}</TableCell>
                        <TableCell>{translate('forms.salePrice')}</TableCell>
                        <TableCell>{translate('common.warranty')}</TableCell>
                        <TableCell>{translate('common.created')}</TableCell>
                        <TableCell>{translate('common.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {machinesQuery.data.map((machine) => (
                        <TableRow key={machine.id} hover>
                          <TableCell>
                            <Button
                              component={Link}
                              to={`/machines/detail/${machine.id}`}
                              size="small"
                              sx={{ minWidth: 'auto', p: 0 }}
                            >
                              #{machine.id}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              component={Link}
                              to={`/machines/model?name=${encodeURIComponent(machine.name)}${machine.catalogue_number ? `&catalogue_number=${encodeURIComponent(machine.catalogue_number)}` : ''}`}
                              size="small"
                              sx={{ minWidth: 'auto', p: 0, textTransform: 'none' }}
                            >
                              {machine.name}
                            </Button>
                          </TableCell>
                          <TableCell>{machine.catalogue_number || '-'}</TableCell>
                          <TableCell>{machine.serial_number || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={machine.is_sale ? translate('forms.sale') : translate('forms.assignment')}
                              color={machine.is_sale ? 'success' : 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {machine.sale_price ? (
                              <Typography variant="body2" fontWeight="medium">
                                €{parseFloat(machine.sale_price).toFixed(2)}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="textSecondary">-</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {machine.warranty_active ? (
                              <Chip
                                label={translate('common.underWarranty')}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            ) : machine.warranty_expiry_date ? (
                              <Chip
                                label={translate('common.expired')}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label={translate('common.noWarranty')}
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(machine.created_at)}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={translate('common.viewMachineDetails')}>
                              <IconButton
                                size="small"
                                component={Link}
                                to={`/machines/detail/${machine.id}`}
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
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon />
                    {translate('common.customerStatistics')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.totalMachines')}
                      </Typography>
                      <Chip
                        label={machinesQuery.data?.length || 0}
                        color="primary"
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.memberSince')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(customer.created_at)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.lastUpdated')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(customer.updated_at)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon />
                    {translate('common.warrantyOverview')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.underWarranty')}
                      </Typography>
                      <Chip
                        label={(machinesQuery.data || []).filter(m => m.warranty_active).length}
                        color="success"
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.expiredWarranty')}
                      </Typography>
                      <Chip
                        label={(machinesQuery.data || []).filter(m => m.warranty_expiry_date && !m.warranty_active).length}
                        color="error"
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.noWarranty')}
                      </Typography>
                      <Chip
                        label={(machinesQuery.data || []).filter(m => !m.warranty_expiry_date).length}
                        color="default"
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              {/* Sales Metrics */}
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SalesIcon />
                    {translate('common.salesMetrics')}
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.totalPurchases')}
                          </Typography>
                          <Chip
                            label={(machinesQuery.data || []).filter(m => m.is_sale).length}
                            color="success"
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.totalAssignments')}
                          </Typography>
                          <Chip
                            label={(machinesQuery.data || []).filter(m => !m.is_sale).length}
                            color="default"
                            size="small"
                          />
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.totalSpent')}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            €{(machinesQuery.data || [])
                              .filter(m => m.is_sale && m.sale_price)
                              .reduce((sum, m) => sum + parseFloat(m.sale_price), 0)
                              .toFixed(2)
                            }
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.avgPurchasePrice')}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            €{(() => {
                              const purchases = (machinesQuery.data || []).filter(m => m.is_sale && m.sale_price);
                              return purchases.length > 0 
                                ? (purchases.reduce((sum, m) => sum + parseFloat(m.sale_price), 0) / purchases.length).toFixed(2)
                                : '0.00';
                            })()}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('forms.new')} {translate('common.machines')}
                          </Typography>
                          <Chip
                            label={(machinesQuery.data || []).filter(m => m.machine_condition === 'new').length}
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('forms.used')} {translate('common.machines')}
                          </Typography>
                          <Chip
                            label={(machinesQuery.data || []).filter(m => m.machine_condition === 'used').length}
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.lastPurchase')}
                          </Typography>
                          <Typography variant="body2">
                            {(() => {
                              const lastPurchase = (machinesQuery.data || [])
                                .filter(m => m.is_sale && m.sale_date)
                                .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];
                              return lastPurchase ? formatDate(lastPurchase.sale_date) : '-';
                            })()}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {translate('common.customerValue')}
                          </Typography>
                          <Chip
                            label={(() => {
                              const totalSpent = (machinesQuery.data || [])
                                .filter(m => m.is_sale && m.sale_price)
                                .reduce((sum, m) => sum + parseFloat(m.sale_price), 0);
                              if (totalSpent > 5000) return translate('common.highValue');
                              if (totalSpent > 1000) return translate('common.mediumValue');
                              return translate('common.lowValue');
                            })()}
                            color={(() => {
                              const totalSpent = (machinesQuery.data || [])
                                .filter(m => m.is_sale && m.sale_price)
                                .reduce((sum, m) => sum + parseFloat(m.sale_price), 0);
                              if (totalSpent > 5000) return 'success';
                              if (totalSpent > 1000) return 'warning';
                              return 'default';
                            })()}
                            size="small"
                          />
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('common.deleteCustomer')}</DialogTitle>
        <DialogContent>
                      <Typography>
              {translate('common.deleteCustomerConfirmation', { name: customer.name })}
            </Typography>
          {machinesQuery.data?.length > 0 && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                {translate('common.customerHasMachinesWarning', { count: machinesQuery.data.length })}
              </Alert>
          )}
        </DialogContent>
        <DialogActions>
                      <Button onClick={() => setDeleteDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteCustomer.mutate()
              setDeleteDialogOpen(false)
            }}
            disabled={deleteCustomer.isLoading}
                      >
              {deleteCustomer.isLoading ? translate('common.deleting') : translate('common.delete')}
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
