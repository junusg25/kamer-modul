import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useDebounce } from '../hooks/useDebounce'
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
  Alert,
  CircularProgress,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Tooltip,
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
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateCustomerQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js'

export default function Customers() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { translate, formatDate } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [customerToDelete, setCustomerToDelete] = React.useState(null)

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [selectedCustomerForMenu, setSelectedCustomerForMenu] = React.useState(null)

  // Modal state


  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setSearchQuery(search)
    }
  }

  // Query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });

  if (searchQuery) queryParams.append('search', searchQuery);

  const customers = useQuery({
    queryKey: ['customers', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/customers?${queryParams.toString()}`);
      return response.data;
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Force refetch when component mounts to ensure fresh data
  React.useEffect(() => {
    if (customers.refetch) {
      customers.refetch();
    }
  }, []);



  const deleteCustomer = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: async () => {
      // Invalidate and refetch customer queries
      await invalidateCustomerQueries(queryClient);
      
      // Also invalidate dashboard since customer deletion affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.customerDeleted'))
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteCustomer'))
    },
  })

  const handleDelete = (customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomer.mutate(customerToDelete.id)
    }
  }



  const canDeleteCustomer = (customer) => {
    return isAdmin || isManager
  }

  const canEditCustomer = (customer) => {
    return isAdmin || isManager || user?.role === 'technician'
  }

  // Menu handlers
  const handleMenuOpen = (event, customer) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedCustomerForMenu(customer)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setSelectedCustomerForMenu(null)
  }

  const handleMenuAction = (action) => {
    if (!selectedCustomerForMenu) return
    
    switch (action) {
      case 'view':
        navigate(`/customers/${selectedCustomerForMenu.id}`)
        break
      case 'edit':
        navigate(`/customers/${selectedCustomerForMenu.id}/edit`)
        break
      case 'delete':
        setCustomerToDelete(selectedCustomerForMenu)
        handleDelete(selectedCustomerForMenu)
        break
      default:
        break
    }
    handleMenuClose()
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (customers.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {customers.error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {translate('navigation.customers')}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/unified-customer')}
          >
            Unified Form
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-customer')}
          >
            {translate('actions.newCustomer')}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder={translate('navigation.searchCustomersPlaceholder')}
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
          
          <IconButton onClick={() => customers.refetch()} disabled={customers.isLoading}>
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
                <TableCell>{translate('tableHeaders.id')}</TableCell>
                <TableCell>{translate('forms.customerName')}</TableCell>
                <TableCell>{translate('forms.companyName')}</TableCell>
                <TableCell>{translate('forms.email')}</TableCell>
                <TableCell>{translate('forms.phone')}</TableCell>
                <TableCell>{translate('forms.city')}</TableCell>
                <TableCell>{translate('tableHeaders.createdAt')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : customers.data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {translate('common.noCustomersFound')}
                  </TableCell>
                </TableRow>
              ) : (
                customers.data?.data?.map((customer) => (
                                     <TableRow 
                     key={customer.id} 
                     hover 
                     onClick={() => navigate(`/customers/${customer.id}`)}
                     sx={{ cursor: 'pointer' }}
                   >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        #{customer.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                          {getInitials(customer.name)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {customer.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.company_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.email || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.phone || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.city || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(customer.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                                               <IconButton
                           size="small"
                           onClick={(event) => {
                             event.stopPropagation();
                             handleMenuOpen(event, customer);
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
        {customers.data?.pagination && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={customers.data.pagination.pages}
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
        <DialogTitle>{translate('dialogs.deleteCustomer')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteCustomerConfirmation')}
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
            disabled={deleteCustomer.isLoading}
          >
            {deleteCustomer.isLoading ? <CircularProgress size={20} /> : translate('actions.delete')}
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
        

        
        {selectedCustomerForMenu && canDeleteCustomer(selectedCustomerForMenu) && (
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


