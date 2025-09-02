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
  Grid,
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
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateInventoryQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js'

export default function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { translate, formatDate } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState(null)

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [selectedItemForMenu, setSelectedItemForMenu] = React.useState(null)



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

  const inventory = useQuery({
    queryKey: ['inventory', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/inventory?${queryParams.toString()}`);
      return response.data;
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Force refetch when component mounts to ensure fresh data
  React.useEffect(() => {
    if (inventory.refetch) {
      inventory.refetch();
    }
  }, []);



  const deleteItem = useMutation({
    mutationFn: (id) => api.delete(`/inventory/${id}`),
    onSuccess: async () => {
      // Invalidate and refetch inventory queries
      await invalidateInventoryQueries(queryClient)
      
      // Also invalidate dashboard since inventory changes affect stats
      await invalidateDashboardQueries(queryClient)
      
      toast.success(translate('notifications.inventoryItemDeleted'))
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteInventoryItem'))
    },
  })

  const handleDelete = (item) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem.mutate(itemToDelete.id)
    }
  }



  const canDeleteItem = (item) => {
    return isAdmin || isManager
  }

  const canEditItem = (item) => {
    return isAdmin || isManager || user?.role === 'technician'
  }

  // Menu handlers
  const handleMenuOpen = (event, item) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedItemForMenu(item)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setSelectedItemForMenu(null)
  }

  const handleMenuAction = (action) => {
    if (!selectedItemForMenu) return
    
    switch (action) {
      case 'view':
        navigate(`/inventory/${selectedItemForMenu.id}`)
        break
      case 'edit':
        navigate(`/inventory/${selectedItemForMenu.id}/edit`)
        break
      case 'delete':
        setItemToDelete(selectedItemForMenu)
        handleDelete(selectedItemForMenu)
        break
      default:
        break
    }
    handleMenuClose()
  }

  const getStockStatus = (quantity, minStockLevel = 5) => {
    if (quantity <= 0) return { status: 'out', color: 'error', label: translate('status.outOfStock') }
    if (quantity <= minStockLevel) return { status: 'low', color: 'warning', label: translate('status.lowStock') }
    return { status: 'in', color: 'success', label: translate('status.inStock') }
  }

  if (inventory.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {inventory.error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {translate('navigation.inventory')}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/unified-inventory')}
          >
            Unified Form
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-inventory-item')}
          >
            {translate('actions.newInventoryItem')}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder={translate('navigation.searchInventoryPlaceholder')}
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
          
          <IconButton onClick={() => inventory.refetch()} disabled={inventory.isLoading}>
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
                <TableCell>{translate('forms.itemName')}</TableCell>
                <TableCell>{translate('forms.sku')}</TableCell>
                <TableCell>{translate('forms.category')}</TableCell>
                <TableCell>{translate('forms.quantity')}</TableCell>
                <TableCell>{translate('forms.unitPrice')}</TableCell>
                <TableCell>{translate('tableHeaders.stockStatus')}</TableCell>
                <TableCell>{translate('forms.supplier')}</TableCell>
                <TableCell>{translate('forms.location')}</TableCell>
                <TableCell>{translate('tableHeaders.lastUpdated')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : inventory.data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    {translate('common.noInventoryItemsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                inventory.data?.data?.map((item) => {
                  const stockStatus = getStockStatus(item.quantity, item.min_stock_level)
                  return (
                                         <TableRow 
                       key={item.id} 
                       hover 
                       onClick={() => navigate(`/inventory/${item.id}`)}
                       sx={{ cursor: 'pointer' }}
                     >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          #{item.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <InventoryIcon color="action" />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.sku || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.category || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {item.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${item.unit_price?.toFixed(2) || '0.00'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={stockStatus.label}
                          color={stockStatus.color}
                          size="small"
                          icon={stockStatus.status === 'low' ? <WarningIcon /> : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.supplier || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.location || '-'}
                        </Typography>
                      </TableCell>
                                          <TableCell>
                      <Typography variant="body2">
                        {formatDate(item.updated_at)}
                      </Typography>
                    </TableCell>
                      <TableCell>
                                                 <IconButton
                           size="small"
                           onClick={(event) => {
                             event.stopPropagation();
                             handleMenuOpen(event, item);
                           }}
                         >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {inventory.data?.pagination && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={inventory.data.pagination.pages}
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
        <DialogTitle>{translate('dialogs.deleteInventoryItem')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteInventoryItemConfirmation')}
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
            disabled={deleteItem.isLoading}
          >
            {deleteItem.isLoading ? <CircularProgress size={20} /> : translate('actions.delete')}
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
        

        
        {selectedItemForMenu && canDeleteItem(selectedItemForMenu) && (
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
