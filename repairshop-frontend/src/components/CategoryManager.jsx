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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function CategoryManager({ open, onClose }) {
  const { translate } = useLanguage();
  const queryClient = useQueryClient();

  // State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isEdit, setIsEdit] = useState(false);

  // Fetch categories
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['machine-categories'],
    queryFn: async () => {
      const response = await api.get('/machines/categories');
      return response.data;
    },
    enabled: open
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: (categoryData) => api.post('/machines/categories', categoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-categories'] });
      toast.success(translate('notifications.categoryCreated'));
      handleCloseEditDialog();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToCreateCategory'));
    },
  });

  // Update category mutation
  const updateCategory = useMutation({
    mutationFn: (categoryData) => api.patch(`/machines/categories/${categoryData.id}`, { name: categoryData.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-categories'] });
      toast.success(translate('notifications.categoryUpdated'));
      handleCloseEditDialog();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToUpdateCategory'));
    },
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: (categoryId) => api.delete(`/machines/categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-categories'] });
      toast.success(translate('notifications.categoryDeleted'));
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteCategory'));
    },
  });

  // Handlers
  const handleAddCategory = () => {
    setIsEdit(false);
    setFormData({ name: '' });
    setEditDialogOpen(true);
  };

  const handleEditCategory = (category) => {
    setIsEdit(true);
    setSelectedCategory(category);
    setFormData({ name: category.name });
    setEditDialogOpen(true);
  };

  const handleDeleteCategory = (category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setFormData({ name: '' });
    setSelectedCategory(null);
    setIsEdit(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(translate('errors.categoryNameRequired'));
      return;
    }

    if (isEdit) {
      updateCategory.mutate({ id: selectedCategory.id, name: formData.name.trim() });
    } else {
      createCategory.mutate({ name: formData.name.trim() });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedCategory) {
      deleteCategory.mutate(selectedCategory.id);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {translate('pages.manageCategories')}
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {/* Header with Add Button */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="body2" color="text.secondary">
              {translate('pages.categoriesDescription')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddCategory}
              size="small"
            >
              {translate('actions.addCategory')}
            </Button>
          </Box>

          {/* Categories Table */}
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{translate('tableHeaders.categoryName')}</TableCell>
                    <TableCell>{translate('tableHeaders.machineModels')}</TableCell>
                    <TableCell>{translate('tableHeaders.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Alert severity="error">
                          {translate('errors.failedToLoadCategories')}
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : categories?.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        {translate('common.noCategories')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories?.data?.map((category) => (
                      <TableRow key={category.id} hover>
                        <TableCell>
                          <Typography variant="body1">
                            {category.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={category.machine_models_count || 0}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Tooltip title={translate('actions.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEditCategory(category)}
                                color="primary"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={translate('actions.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCategory(category)}
                                color="error"
                                disabled={category.machine_models_count > 0}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isEdit ? translate('actions.editCategory') : translate('actions.addCategory')}
        </DialogTitle>
        
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={translate('tableHeaders.categoryName')}
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              margin="normal"
              required
              autoFocus
              disabled={createCategory.isPending || updateCategory.isPending}
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleCloseEditDialog}
            disabled={createCategory.isPending || updateCategory.isPending}
          >
            {translate('actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createCategory.isPending || updateCategory.isPending || !formData.name.trim()}
          >
            {createCategory.isPending || updateCategory.isPending ? (
              <CircularProgress size={20} />
            ) : isEdit ? (
              translate('actions.update')
            ) : (
              translate('actions.create')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {translate('actions.confirmDelete')}
        </DialogTitle>
        
        <DialogContent>
          <Typography>
            {translate('messages.confirmDeleteCategory', { name: selectedCategory?.name })}
          </Typography>
          {selectedCategory?.machine_models_count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {translate('messages.categoryInUse', { count: selectedCategory.machine_models_count })}
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleteCategory.isPending}
          >
            {translate('actions.cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleteCategory.isPending || selectedCategory?.machine_models_count > 0}
          >
            {deleteCategory.isPending ? (
              <CircularProgress size={20} />
            ) : (
              translate('actions.delete')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
