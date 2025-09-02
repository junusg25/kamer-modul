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
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { invalidateUserQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js'

export default function Users() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { translate, formatDate } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [userToDelete, setUserToDelete] = React.useState(null)

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [selectedUserForMenu, setSelectedUserForMenu] = React.useState(null)

  // Modal state
  const [newUserModalOpen, setNewUserModalOpen] = React.useState(false)
  const [newUserForm, setNewUserForm] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
    phone: '',
    department: '',
  })

  const isAdmin = user?.role === 'admin'

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

  const users = useQuery({
    queryKey: ['users', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/users?${queryParams.toString()}`);
      return response.data;
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Force refetch when component mounts to ensure fresh data
  React.useEffect(() => {
    if (users.refetch) {
      users.refetch();
    }
  }, []);

  const createUser = useMutation({
    mutationFn: (userData) => api.post('/users', userData),
    onSuccess: async () => {
      // Invalidate and refetch user queries
      await invalidateUserQueries(queryClient)
      
      // Also invalidate dashboard since user creation affects stats
      await invalidateDashboardQueries(queryClient)
      
      toast.success(translate('notifications.userCreated'))
      setNewUserModalOpen(false)
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'technician',
      })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToCreateUser'))
    },
  })

  const deleteUser = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: async () => {
      // Invalidate and refetch user queries
      await invalidateUserQueries(queryClient)
      
      // Also invalidate dashboard since user deletion affects stats
      await invalidateDashboardQueries(queryClient)
      
      toast.success(translate('notifications.userDeleted'))
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.failedToDeleteUser'))
    },
  })

  const handleDelete = (user) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUser.mutate(userToDelete.id)
    }
  }

  const handleCreateUser = () => {
    createUser.mutate(newUserForm)
  }

  const canDeleteUser = (userToCheck) => {
    return isAdmin && userToCheck.id !== user?.id
  }

  // Menu handlers
  const handleMenuOpen = (event, userItem) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedUserForMenu(userItem)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setSelectedUserForMenu(null)
  }

  const handleMenuAction = (action) => {
    if (!selectedUserForMenu) return
    
    switch (action) {
      case 'view':
        navigate(`/users/${selectedUserForMenu.id}`)
        break
      case 'edit':
        navigate(`/users/${selectedUserForMenu.id}/edit`)
        break
      case 'delete':
        setUserToDelete(selectedUserForMenu)
        handleDelete(selectedUserForMenu)
        break
      default:
        break
    }
    handleMenuClose()
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error'
      case 'manager': return 'warning'
      case 'technician': return 'primary'
      default: return 'default'
    }
  }

  if (users.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {users.error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {translate('navigation.users')}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/unified-user')}
          >
            Unified Form
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-user')}
          >
            {translate('actions.newUser')}
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder={translate('navigation.searchUsersPlaceholder')}
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
          
          <IconButton onClick={() => users.refetch()} disabled={users.isLoading}>
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
                <TableCell>{translate('forms.name')}</TableCell>
                <TableCell>{translate('forms.email')}</TableCell>
                <TableCell>{translate('forms.phone')}</TableCell>
                <TableCell>{translate('forms.department')}</TableCell>
                <TableCell>{translate('tableHeaders.role')}</TableCell>
                <TableCell>{translate('tableHeaders.status')}</TableCell>
                <TableCell>{translate('tableHeaders.lastLogin')}</TableCell>
                <TableCell>{translate('tableHeaders.createdAt')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    {translate('common.noUsersFound')}
                  </TableCell>
                </TableRow>
              ) : (
                users.data?.data?.map((userItem) => (
                                     <TableRow 
                     key={userItem.id} 
                     hover 
                     onClick={() => navigate(`/users/${userItem.id}`)}
                     sx={{ cursor: 'pointer' }}
                   >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        #{userItem.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PersonIcon color="action" />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {userItem.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {userItem.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {userItem.phone || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {userItem.department || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={translate(`roles.${userItem.role}`)}
                        color={getRoleColor(userItem.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={translate(`status.${userItem.status || 'active'}`)}
                        color={userItem.status === 'active' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(userItem.last_login)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(userItem.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                                               <IconButton
                           size="small"
                           onClick={(event) => {
                             event.stopPropagation();
                             handleMenuOpen(event, userItem);
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
        {users.data?.pagination && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={users.data.pagination.pages}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Create User Modal */}
      <Dialog 
        open={newUserModalOpen} 
        onClose={() => setNewUserModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{translate('dialogs.createNewUser')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('forms.name')}
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('forms.email')}
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('forms.password')}
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>{translate('tableHeaders.role')}</InputLabel>
                <Select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                  label={translate('tableHeaders.role')}
                >
                  <MenuItem value="technician">{translate('roles.technician')}</MenuItem>
                  <MenuItem value="manager">{translate('roles.manager')}</MenuItem>
                  <MenuItem value="admin">{translate('roles.admin')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.phone')}
                value={newUserForm.phone}
                onChange={(e) => setNewUserForm({...newUserForm, phone: e.target.value})}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.department')}
                value={newUserForm.department}
                onChange={(e) => setNewUserForm({...newUserForm, department: e.target.value})}
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewUserModalOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={handleCreateUser}
            variant="contained"
            disabled={createUser.isLoading || !newUserForm.name.trim() || !newUserForm.email.trim() || !newUserForm.password.trim()}
          >
            {createUser.isLoading ? <CircularProgress size={20} /> : translate('actions.createUser')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{translate('dialogs.deleteUser')}</DialogTitle>
        <DialogContent>
          <Typography>
            {translate('dialogs.deleteUserConfirmation')}
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
            disabled={deleteUser.isLoading}
          >
            {deleteUser.isLoading ? <CircularProgress size={20} /> : translate('actions.delete')}
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
        

        
        {selectedUserForMenu && canDeleteUser(selectedUserForMenu) && (
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


