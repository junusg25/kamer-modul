import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Alert,
  CircularProgress,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { invalidateMachineQueries } from '../utils/cacheUtils.js';
import CategoryManager from '../components/CategoryManager';

export default function Machines() {
  const { translate } = useLanguage();
  const { user, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // Query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });

  if (searchQuery) {
    queryParams.append('search', searchQuery);
  }
  if (categoryFilter) {
    queryParams.append('category', categoryFilter);
  }
  if (manufacturerFilter) {
    queryParams.append('manufacturer', manufacturerFilter);
  }

  // Fetch machine models
  const { data: machineModels, isLoading, error, refetch } = useQuery({
    queryKey: ['machine-models', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/machines/models?${queryParams.toString()}`);
      return response.data;
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/machines/categories');
      return response.data;
    },
    refetchOnMount: true,
  });

  // Fetch manufacturers for filter
  const { data: manufacturers, isLoading: manufacturersLoading, error: manufacturersError } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      try {
        const response = await api.get('/machines/models?limit=1000'); // Get all models to extract manufacturers
        const models = response.data?.data || response.data || [];
        const uniqueManufacturers = [...new Set(models.map(model => model.manufacturer).filter(Boolean))];
        return uniqueManufacturers.sort();
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
        return [];
      }
    },
    refetchOnMount: true,
    retry: 3,
  });

  // Delete mutation
  const deleteModel = useMutation({
    mutationFn: (modelData) => api.delete(`/machines/models/${modelData.id}`),
    onSuccess: async () => {
      await invalidateMachineQueries(queryClient);
      toast.success(translate('notifications.machineModelDeleted'));
      setDeleteDialogOpen(false);
      setModelToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteMachineModel'));
    },
  });

  // Handlers
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setPage(1);
      refetch();
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (!e.target.value) {
      setPage(1);
      refetch();
    }
  };

  const handleDelete = (model) => {
    setModelToDelete(model);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (modelToDelete) {
      deleteModel.mutate(modelToDelete);
    }
  };

  const handleMenuOpen = (event, model) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedModel(model);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedModel(null);
  };

  const handleMenuAction = (action) => {
    if (!selectedModel) return;
    
    switch (action) {
      case 'view':
        navigate(`/machines/model/${selectedModel.id}`);
        break;
      case 'edit':
        navigate(`/edit-machine/${selectedModel.id}`);
        break;
      case 'delete':
        handleDelete(selectedModel);
        break;
      default:
        break;
    }
    handleMenuClose();
  };

  const canDeleteModel = (model) => {
    return true; // Everyone can delete machine models
  };

  const canEditModel = (model) => {
    return true; // Everyone can edit machine models
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {error.message}
        </Alert>
      </Box>
    );
  }

  const models = machineModels?.data || [];
  const totalPages = machineModels?.totalPages || 1;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {translate('pages.machines')}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => setCategoryManagerOpen(true)}
          >
            {translate('actions.manageCategories')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-machine')}
          >
            {translate('actions.newMachineModel')}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder={translate('navigation.searchMachineModelsPlaceholder')}
            value={searchQuery}
            onChange={handleSearchChange}
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
            <InputLabel>{translate('tableHeaders.category')}</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              label={translate('tableHeaders.category')}
            >
              <MenuItem value="">{translate('common.all')}</MenuItem>
              {categories?.data?.map((category) => (
                <MenuItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('tableHeaders.manufacturer')}</InputLabel>
            <Select
              value={manufacturerFilter}
              onChange={(e) => setManufacturerFilter(e.target.value)}
              label={translate('tableHeaders.manufacturer')}
              disabled={manufacturersLoading}
            >
              <MenuItem value="">{translate('common.all')}</MenuItem>
              {manufacturersLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  {translate('common.loading')}
                </MenuItem>
              ) : Array.isArray(manufacturers) && manufacturers.map((manufacturer) => (
                <MenuItem key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Category Manager */}
      <CategoryManager 
        open={categoryManagerOpen} 
        onClose={() => setCategoryManagerOpen(false)} 
      />

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('tableHeaders.modelName')}</TableCell>
                <TableCell>{translate('tableHeaders.catalogueNumber')}</TableCell>
                <TableCell>{translate('tableHeaders.manufacturer')}</TableCell>
                <TableCell>{translate('tableHeaders.category')}</TableCell>
                <TableCell>{translate('tableHeaders.warrantyPeriod')}</TableCell>
                <TableCell>{translate('tableHeaders.totalAssigned')}</TableCell>
                <TableCell>{translate('tableHeaders.description')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : !Array.isArray(models) || models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {translate('common.noMachineModels')}
                  </TableCell>
                </TableRow>
              ) : Array.isArray(models) ? (
                models.map((model, index) => (
                                     <TableRow 
                     key={model.id || index} 
                     hover 
                     onClick={() => navigate(`/machines/model/${model.id}`)}
                     sx={{ cursor: 'pointer' }}
                   >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {model.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {model.catalogue_number || translate('common.notSpecified')}
                    </TableCell>
                    <TableCell>
                      {model.manufacturer || translate('common.notSpecified')}
                    </TableCell>
                    <TableCell>
                      {model.category_name || translate('common.notSpecified')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={`${model.warranty_months || 12} months`}
                        color="info"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={`${model.total_assigned || 0}`}
                        color={model.total_assigned > 0 ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {model.description || translate('common.noDescription')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, model)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuAction('view')}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('actions.view')}</ListItemText>
        </MenuItem>
        {canEditModel(selectedModel) && (
          <MenuItem onClick={() => handleMenuAction('edit')}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{translate('actions.edit')}</ListItemText>
          </MenuItem>
        )}
        {canDeleteModel(selectedModel) && (
          <MenuItem onClick={() => handleMenuAction('delete')} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{translate('actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{translate('dialogs.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteModelMessage')} <strong>{modelToDelete?.name}</strong>?
            {modelToDelete?.total_assigned > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {translate('dialogs.deleteModelWarning', { count: modelToDelete.total_assigned })}
              </Alert>
            )}
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
            disabled={deleteModel.isPending}
          >
            {deleteModel.isPending ? translate('actions.deleting') : translate('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
