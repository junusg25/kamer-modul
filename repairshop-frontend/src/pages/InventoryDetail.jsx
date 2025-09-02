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
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Info as InfoIcon,
  Description as DescriptionIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CalendarToday as CalendarIcon,
  Update as UpdateIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  Engineering as EngineeringIcon,
  Category as CategoryIcon,
  LocationOn as LocationOnIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'

export default function InventoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { translate, formatDate } = useLanguage()
  const [activeTab, setActiveTab] = React.useState(0)

  const inventoryQuery = useQuery({
    queryKey: ['inventoryItem', id],
    queryFn: async () => (await api.get(`/inventory/${id}`)).data.data,
  })

  const workOrdersQuery = useQuery({
    queryKey: ['inventory-work-orders', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/workOrders/by-inventory/${id}`)).data.data,
  })

  const updateItem = useMutation({
    mutationFn: (updates) => api.patch(`/inventory/${id}`, updates).then(r => r.data),
          onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['inventoryItem', id] }); 
        toast.success(translate('notifications.inventoryItemUpdated')) 
      },
  })

  const deleteItem = useMutation({
    mutationFn: () => api.delete(`/inventory/${id}`).then(r => r.data),
    onSuccess: () => { toast.success(translate('notifications.inventoryItemDeleted')); navigate('/inventory') },
    onError: (e) => toast.error(e?.response?.data?.message || translate('errors.deleteFailed'))
  })

  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ 
    name: '', 
    description: '', 
    quantity: 0,
    unit_price: 0,
    category: '',
    min_stock_level: 5,
    supplier: '',
    sku: '',
    location: ''
  })

  React.useEffect(() => {
    if (inventoryQuery.data) {
      const item = inventoryQuery.data
      setForm({
        name: item.name || '',
        description: item.description || '',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        category: item.category || '',
        min_stock_level: item.min_stock_level || 5,
        supplier: item.supplier || '',
        sku: item.sku || '',
        location: item.location || ''
      })
    }
  }, [inventoryQuery.data])

  if (inventoryQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (inventoryQuery.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{inventoryQuery.error.message}</Alert>
      </Box>
    )
  }

  const item = inventoryQuery.data

  const onSave = () => {
    const updateData = {
      name: form.name,
      description: form.description,
      quantity: Number(form.quantity),
      unit_price: Number(form.unit_price),
      category: form.category,
      min_stock_level: Number(form.min_stock_level),
      supplier: form.supplier,
      sku: form.sku,
      location: form.location
    };
    
    updateItem.mutate(updateData, { onSuccess: () => setIsEditing(false) })
  }

  const onCancel = () => {
    setIsEditing(false)
    setForm({
      name: item.name || '',
      description: item.description || '',
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      category: item.category || '',
      min_stock_level: item.min_stock_level || 5,
      supplier: item.supplier || '',
      sku: item.sku || '',
      location: item.location || ''
    })
  }

  const getStockStatus = () => {
    if (item.quantity === 0) {
      return { status: translate('common.outOfStock'), color: 'error', icon: <ErrorIcon /> }
    } else if (item.quantity <= (item.min_stock_level || 5)) {
      return { status: translate('common.lowStock'), color: 'warning', icon: <WarningIcon /> }
    } else {
      return { status: translate('common.inStock'), color: 'success', icon: <CheckCircleIcon /> }
    }
  }

  const stockStatus = getStockStatus()
  const totalValue = (item.quantity || 0) * (Number(item.unit_price) || 0)

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
              <InventoryIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                {item.name}
              </Typography>
                              <Typography variant="body2" color="text.secondary">
                  {translate('common.item')} #{item.id}
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
                disabled={updateItem.isLoading}
                onClick={onSave}
                              >
                  {updateItem.isLoading ? translate('common.saving') : translate('common.save')}
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
                {translate('common.stockStatus')}
              </Typography>
              <Chip
                icon={stockStatus.icon}
                label={stockStatus.status}
                color={stockStatus.color}
                size="large"
                sx={{ fontSize: '1rem', py: 1 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.currentStock')}
              </Typography>
              <Typography variant="h6" color={stockStatus.color}>
                {item.quantity}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.totalValue')}
              </Typography>
              <Typography variant="h6" color="primary">
                ${totalValue.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {translate('common.usedInWorkOrders')}
              </Typography>
              <Chip
                label={workOrdersQuery.data?.length || 0}
                color="primary"
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
            label={translate('common.itemDetails')} 
            icon={<InventoryIcon />} 
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
          {/* Item Details Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <InventoryIcon fontSize="small" />
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
                          item.name
                        )
                      }
                      secondary={translate('common.itemName')}
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
                            {item.description || translate('common.noDescription')}
                          </Typography>
                        )
                      }
                      secondary={translate('common.description')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <ShoppingCartIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            min={0}
                            value={form.quantity}
                            onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                          />
                        ) : (
                          item.quantity
                        )
                      }
                      secondary={translate('forms.quantity')}
                    />
                  </ListItem>
                  
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <MoneyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.unit_price}
                            onChange={(e) => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                          />
                        ) : (
                          `$${(Number(item.unit_price) || 0).toFixed(2)}`
                        )
                      }
                      secondary={translate('forms.unitPrice')}
                    />
                  </ListItem>

                  {item.category && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CategoryIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          isEditing ? (
                            <TextField
                              fullWidth
                              size="small"
                              value={form.category}
                              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                            />
                          ) : (
                            item.category
                          )
                        }
                        secondary={translate('forms.category')}
                      />
                    </ListItem>
                  )}

                  {item.sku && (
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
                              value={form.sku}
                              onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
                            />
                          ) : (
                            item.sku
                          )
                        }
                        secondary={translate('forms.sku')}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <List>
                  {item.supplier && (
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
                              value={form.supplier}
                              onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
                            />
                          ) : (
                            item.supplier
                          )
                        }
                        secondary={translate('forms.supplier')}
                      />
                    </ListItem>
                  )}

                  {item.location && (
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
                              value={form.location}
                              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                            />
                          ) : (
                            item.location
                          )
                        }
                        secondary={translate('forms.location')}
                      />
                    </ListItem>
                  )}

                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <SecurityIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        isEditing ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            min={0}
                            value={form.min_stock_level}
                            onChange={(e) => setForm(f => ({ ...f, min_stock_level: e.target.value }))}
                          />
                        ) : (
                          item.min_stock_level || 5
                        )
                      }
                      secondary={translate('forms.minStockLevel')}
                    />
                  </ListItem>

                  {item.quantity <= (item.min_stock_level || 5) && item.quantity > 0 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <WarningIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {translate('common.stockLevel')}
                              </Typography>
                              <Typography variant="body2">
                                {item.quantity}/{item.min_stock_level || 5}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(item.quantity / (item.min_stock_level || 5)) * 100}
                              color="warning"
                            />
                          </Box>
                        }
                        secondary={translate('common.lowStockWarning')}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}

          {/* Work Orders Tab */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon />
                  {translate('common.workOrdersUsingThisItem')} ({workOrdersQuery.data?.length || 0})
                </Typography>
                <Chip
                  label={`${workOrdersQuery.data?.length || 0} orders`}
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
                    {translate('common.noWorkOrdersFoundUsingThisItem')}
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
                        <TableCell>{translate('common.quantityUsed')}</TableCell>
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
                            <Chip
                              label={workOrder.used_quantity || 1}
                              size="small"
                              color="primary"
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
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon />
                    {translate('common.itemStatistics')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.usedInWorkOrders')}
                      </Typography>
                      <Chip
                        label={workOrdersQuery.data?.length || 0}
                        color="primary"
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.created')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(item.created_at)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.lastUpdated')}
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(item.updated_at)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon />
                    {translate('common.financialOverview')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.totalValue')}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ${totalValue.toFixed(2)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.unitPrice')}
                      </Typography>
                      <Typography variant="body2">
                        ${(Number(item.unit_price) || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {translate('common.stockLevel')}
                      </Typography>
                      <Chip
                        label={`${item.quantity}/${item.min_stock_level || 5}`}
                        color={stockStatus.color}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('common.deleteInventoryItem')}</DialogTitle>
        <DialogContent>
                      <Typography>
              {translate('common.deleteInventoryItemConfirmation', { name: item.name })}
            </Typography>
          {workOrdersQuery.data?.length > 0 && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                {translate('common.inventoryItemUsedInWorkOrdersWarning', { count: workOrdersQuery.data.length })}
              </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{translate('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteItem.mutate()
              setDeleteDialogOpen(false)
            }}
            disabled={deleteItem.isLoading}
                      >
              {deleteItem.isLoading ? translate('common.deleting') : translate('common.delete')}
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
