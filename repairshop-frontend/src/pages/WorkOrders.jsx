import React from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useDebounce } from '../hooks/useDebounce'
import { useModal } from '../contexts/ModalContext'
import { useOptimisticMutation, useOptimisticDelete, useOptimisticCreate, useOptimisticUpdate } from '../hooks/useOptimisticMutation'
import { useWorkOrders, useTechnicians } from '../hooks/useDataFetching'
import api from '../services/api'
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
  Grid,
  Switch,
  FormControlLabel,
  Pagination,
  Tooltip,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateDashboardQueries, invalidateWorkOrderQueries } from '../utils/cacheUtils.js'

export default function WorkOrders() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { translate, formatDate } = useLanguage()

  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [priorityFilter, setPriorityFilter] = React.useState('')
  const [technicianFilter, setTechnicianFilter] = React.useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [workOrderToDelete, setWorkOrderToDelete] = React.useState(null)

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [selectedWorkOrderForMenu, setSelectedWorkOrderForMenu] = React.useState(null)

  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setSearchQuery(search)
    }
  }

  // Fetch data using optimized hooks
  const technicians = useTechnicians()

  // Fetch machine models (without serial numbers) for new machine creation
  const machineModels = useQuery({
    queryKey: ['machineModels'],
    queryFn: async () => {
      try {
        const response = await api.get('/machines')
        // This returns grouped machine models without serial numbers
        return response.data?.data || []
      } catch (error) {
        console.error('Error fetching machine models:', error)
        return []
      }
    },
  })

  // Query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });

  if (searchQuery) queryParams.append('search', searchQuery);
  if (statusFilter) queryParams.append('status', statusFilter);
  if (priorityFilter) queryParams.append('priority', priorityFilter);
  if (technicianFilter) queryParams.append('technician_id', technicianFilter);

  // Fetch work orders
  const workOrders = useQuery({
    queryKey: ['work-orders', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/workOrders?${queryParams.toString()}`);
      return response.data;
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Read URL parameters and set initial filter values
  React.useEffect(() => {
    const status = searchParams.get('status');
    const technician = searchParams.get('technician');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    
    if (status) setStatusFilter(status);
    if (technician) setTechnicianFilter(technician);
    if (priority) setPriorityFilter(priority);
    if (search) {
      setSearch(search);
      setSearchQuery(search);
    }
  }, [searchParams]);

  // Force refetch when component mounts to ensure fresh data
  React.useEffect(() => {
    if (workOrders.refetch) {
      workOrders.refetch();
    }
  }, []);

  const deleteWorkOrder = useMutation({
    mutationFn: (id) => api.delete(`/workOrders/${id}`),
    onSuccess: async () => {
      // Invalidate and refetch work order queries
      await invalidateWorkOrderQueries(queryClient, 'non-warranty');
      
      // Also invalidate dashboard since work order deletion affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.workOrderDeleted'))
      setDeleteDialogOpen(false)
      setWorkOrderToDelete(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteWorkOrder'))
    },
  })

  const handleDelete = (workOrder) => {
    setWorkOrderToDelete(workOrder)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (workOrderToDelete) {
      deleteWorkOrder.mutate(workOrderToDelete.id)
    }
  }

  const canDeleteWorkOrder = (workOrder) => {
    return isAdmin || isManager || (user?.role === 'technician' && workOrder.technician_id === user?.id)
  }

  // Menu handlers
  const handleMenuOpen = (event, workOrder) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedWorkOrderForMenu(workOrder)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setSelectedWorkOrderForMenu(null)
  }

  const handleMenuAction = (action) => {
    if (!selectedWorkOrderForMenu) return
    
    switch (action) {
      case 'view':
        navigate(`/work-orders/${selectedWorkOrderForMenu.id}`)
        break
      case 'edit':
        navigate(`/work-orders/${selectedWorkOrderForMenu.id}/edit`)
        break
      case 'print':
        window.open(`/work-orders/${selectedWorkOrderForMenu.id}/print`, '_blank')
        break
      case 'delete':
        handleDelete(selectedWorkOrderForMenu)
        break
      default:
        break
    }
    handleMenuClose()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return translate('status.pending');
      case 'in_progress': return translate('status.inProgress');
      case 'completed': return translate('status.completed');
      case 'cancelled': return translate('status.cancelled');
      default: return status;
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'urgent': return 'error';
      default: return 'default';
    }
  }

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'low': return translate('status.low');
      case 'medium': return translate('status.medium');
      case 'high': return translate('status.high');
      case 'urgent': return translate('status.urgent');
      default: return priority;
    }
  }

  if (workOrders.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {workOrders.error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder={translate('navigation.searchWorkOrdersPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{translate('tableHeaders.status')}</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label={translate('tableHeaders.status')}
            >
              <MenuItem value="">{translate('status.all')}</MenuItem>
              <MenuItem value="pending">{translate('status.pending')}</MenuItem>
              <MenuItem value="in_progress">{translate('status.inProgress')}</MenuItem>
              <MenuItem value="completed">{translate('status.completed')}</MenuItem>
              <MenuItem value="cancelled">{translate('status.cancelled')}</MenuItem>
              <MenuItem value="testing">{translate('status.testing')}</MenuItem>
              <MenuItem value="parts_ordered">{translate('status.partsOrdered')}</MenuItem>
              <MenuItem value="waiting_approval">{translate('status.waitingApproval')}</MenuItem>
              <MenuItem value="waiting_supplier">{translate('status.waitingSupplier')}</MenuItem>
              <MenuItem value="service_cancelled">{translate('status.serviceCancelled')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{translate('tableHeaders.priority')}</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label={translate('tableHeaders.priority')}
            >
              <MenuItem value="">{translate('common.all')}</MenuItem>
              <MenuItem value="low">{translate('status.low')}</MenuItem>
              <MenuItem value="medium">{translate('status.medium')}</MenuItem>
              <MenuItem value="high">{translate('status.high')}</MenuItem>
              <MenuItem value="urgent">{translate('status.urgent')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('tableHeaders.technician')}</InputLabel>
            <Select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              label={translate('tableHeaders.technician')}
            >
              <MenuItem value="">{translate('common.all')}</MenuItem>
              <MenuItem value="unassigned">{translate('common.unassigned')}</MenuItem>
              {technicians.data?.map((technician) => (
                <MenuItem key={technician.id} value={technician.id}>
                  {technician.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={() => workOrders.refetch()} disabled={workOrders.isLoading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('tableHeaders.workOrderNumber')}</TableCell>
                <TableCell>{translate('tableHeaders.customer')}</TableCell>
                <TableCell>{translate('tableHeaders.machine')}</TableCell>
                <TableCell>{translate('tableHeaders.description')}</TableCell>
                <TableCell>{translate('tableHeaders.status')}</TableCell>
                <TableCell>{translate('tableHeaders.priority')}</TableCell>
                <TableCell>{translate('tableHeaders.technician')}</TableCell>
                <TableCell>{translate('tableHeaders.createdAt')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workOrders.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : workOrders.data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    {translate('common.noWorkOrdersFound')}
                  </TableCell>
                </TableRow>
              ) : (
                workOrders.data?.data?.map((workOrder) => (
                                     <TableRow 
                     key={workOrder.id} 
                     hover 
                     onClick={() => navigate(`/work-orders/${workOrder.id}`)}
                     sx={{ cursor: 'pointer' }}
                   >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {workOrder.formatted_number || `#${workOrder.ticket_number || workOrder.id}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {workOrder.customer_name || translate('common.unassigned')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {workOrder.machine_name || translate('common.unassigned')}
                      </Typography>
                      {workOrder.serial_number && (
                        <Typography variant="caption" color="textSecondary">
                          SN: {workOrder.serial_number}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {workOrder.description?.substring(0, 100)}
                        {workOrder.description?.length > 100 && '...'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(workOrder.status)}
                        color={getStatusColor(workOrder.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPriorityLabel(workOrder.priority)}
                        color={getPriorityColor(workOrder.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {workOrder.technician_name || translate('common.unassigned')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(workOrder.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                                               <IconButton
                           size="small"
                           onClick={(event) => {
                             event.stopPropagation();
                             handleMenuOpen(event, workOrder);
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

        {/* Pagination */}
        {workOrders.data?.pagination && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={workOrders.data.pagination.pages}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{translate('dialogs.deleteWorkOrder')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteWorkOrderConfirmation')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteWorkOrder.isLoading}
          >
            {deleteWorkOrder.isLoading ? <CircularProgress size={20} /> : translate('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleMenuAction('view')}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.viewDetails')}</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction('edit')}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.edit')}</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction('print')}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.print')}</ListItemText>
        </MenuItem>
        
        {selectedWorkOrderForMenu && canDeleteWorkOrder(selectedWorkOrderForMenu) && (
          <MenuItem onClick={() => handleMenuAction('delete')}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{translate('actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}


