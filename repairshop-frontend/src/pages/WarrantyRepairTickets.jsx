import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Fab,
  Grid,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Build as ConvertIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTechnicians } from '../hooks/useDataFetching';
import api from '../services/api';
import { invalidateTicketQueries, invalidateWorkOrderQueries, invalidateDashboardQueries } from '../utils/cacheUtils.js';
import toast from 'react-hot-toast';
import CreateWarrantyRepairTicketModal from '../components/CreateWarrantyRepairTicketModal';
import EditWarrantyRepairTicketModal from '../components/EditWarrantyRepairTicketModal';

const WarrantyRepairTickets = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { translate, formatDate, formatTime, formatDateTime } = useLanguage();
  
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  
  // Fetch data for filters
  const technicians = useTechnicians();
  
  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [convertForm, setConvertForm] = useState({
    technician_id: '',
    priority: 'medium',
  });

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedTicketForMenu, setSelectedTicketForMenu] = useState(null);

  // Read URL parameters and set initial filter values
  useEffect(() => {
    const status = searchParams.get('status');
    const technician = searchParams.get('technician');
    const search = searchParams.get('search');
    
    if (status) setStatusFilter(status);
    if (technician) setTechnicianFilter(technician);
    if (search) setSearch(search);
  }, [searchParams]);

  // Update convertForm when user is available
  useEffect(() => {
    if (user?.id) {
      setConvertForm(prev => ({
        ...prev,
        technician_id: user.id
      }));
    }
  }, [user?.id]);

  // Query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });

  if (search) queryParams.append('search', search);
  if (statusFilter) queryParams.append('status', statusFilter);
  if (technicianFilter) queryParams.append('technician_id', technicianFilter);

  // Fetch warranty repair tickets
  const {
    data: ticketsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['warranty-repair-tickets', queryParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/warrantyRepairTickets?${queryParams.toString()}`);
      return response.data;
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/warrantyRepairTickets/${id}`);
    },
    onSuccess: async () => {
      // Invalidate and refetch ticket queries
      await invalidateTicketQueries(queryClient, 'warranty');
      
      // Also invalidate dashboard since ticket deletion affects stats
      await invalidateDashboardQueries(queryClient);
      
      toast.success(translate('notifications.ticketDeleted'));
    },
    onError: (error) => {
      toast.error(translate('errors.failedToDeleteTicket'));
    }
  });

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: async ({ ticketId, formData }) => {
      const response = await api.post(`/warrantyRepairTickets/${ticketId}/convert`, formData);
      return response.data;
    },
    onSuccess: async (data) => {
      // Invalidate and refetch ticket and work order queries
      await invalidateTicketQueries(queryClient, 'warranty');
      await invalidateWorkOrderQueries(queryClient, 'warranty');
      
      // Also invalidate dashboard since conversion affects stats
      await invalidateDashboardQueries(queryClient);
      
      // Don't show success toast here - notifications will be handled via WebSocket
      // This prevents duplicate messages
      
      // Navigate to the created work order if available
      if (data?.data?.warranty_work_order?.id) {
        navigate(`/warranty-work-orders/${data.data.warranty_work_order.id}`);
      }
    },
    onError: (error) => {
      toast.error(translate('errors.failedToConvertTicket'));
    }
  });

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm(translate('dialogs.deleteWarrantyRepairTicketConfirmation'))) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting ticket:', error);
      }
    }
  };

  // Handle edit
  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setEditModalOpen(true);
  };

  // Handle convert
  const handleConvert = (ticket) => {
    setSelectedTicket(ticket);
    setConvertForm({
      technician_id: (user?.role === 'admin' || user?.role === 'manager') ? '' : user?.id || '',
      priority: 'medium',
    });
    setConvertModalOpen(true);
  };

  // Handle convert submit
  const handleConvertSubmit = async () => {
    try {
      await convertMutation.mutateAsync({
        ticketId: selectedTicket.id,
        formData: convertForm
      });
      setConvertModalOpen(false);
      setSelectedTicket(null);
    } catch (error) {
      console.error('Error converting ticket:', error);
    }
  };

  // Handle view
  const handleView = (ticket) => {
    navigate(`/warranty-repair-tickets/${ticket.id}`);
  };

  // Menu handlers
  const handleMenuOpen = (event, ticket) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedTicketForMenu(ticket);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedTicketForMenu(null);
  };

  const handleMenuAction = (action) => {
    if (!selectedTicketForMenu) return;
    
    switch (action) {
      case 'view':
        handleView(selectedTicketForMenu);
        break;
      case 'edit':
        setSelectedTicket(selectedTicketForMenu);
        setEditModalOpen(true);
        break;
      case 'convert':
        handleConvert(selectedTicketForMenu);
        break;
      case 'delete':
        handleDelete(selectedTicketForMenu.id);
        break;
      default:
        break;
    }
    handleMenuClose();
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'intake': return 'warning';
      case 'converted': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'intake': return translate('status.intake');
      case 'converted': return translate('status.converted');
      case 'cancelled': return translate('status.cancelled');
      default: return status;
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('errors.failedToLoadData')}: {error.message}
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
            placeholder={translate('navigation.searchWarrantyRepairTicketsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              <MenuItem value="">{translate('common.all')}</MenuItem>
              <MenuItem value="intake">{translate('status.intake')}</MenuItem>
              <MenuItem value="converted">{translate('status.converted')}</MenuItem>
              <MenuItem value="cancelled">{translate('status.cancelled')}</MenuItem>
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

          <IconButton onClick={() => refetch()} disabled={isLoading}>
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
                <TableCell>{translate('tableHeaders.ticketNumber')}</TableCell>
                <TableCell>{translate('tableHeaders.customer')}</TableCell>
                <TableCell>{translate('tableHeaders.machine')}</TableCell>
                <TableCell>{translate('tableHeaders.problemDescription')}</TableCell>
                <TableCell>{translate('tableHeaders.status')}</TableCell>
                <TableCell>{translate('forms.submittedBy')}</TableCell>
                <TableCell>{translate('tableHeaders.created')}</TableCell>
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
              ) : ticketsData?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {translate('common.noWarrantyRepairTicketsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                ticketsData?.data?.map((ticket) => (
                                     <TableRow 
                     key={ticket.id} 
                     hover 
                     onClick={() => navigate(`/warranty-repair-tickets/${ticket.id}`)}
                     sx={{ cursor: 'pointer' }}
                   >
                                         <TableCell>
                       <Typography variant="body2" fontWeight="bold">
                         {ticket.formatted_number || `#${ticket.ticket_number}`}
                       </Typography>
                     </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ticket.customer_name}
                      </Typography>
                      {ticket.company_name && (
                        <Typography variant="caption" color="textSecondary">
                          {ticket.company_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ticket.model_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        SN: {ticket.serial_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {ticket.problem_description?.substring(0, 100)}
                        {ticket.problem_description?.length > 100 && '...'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(ticket.status)}
                        color={getStatusColor(ticket.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ticket.submitted_by_name || translate('common.unknown')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(ticket.created_at)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatTime(ticket.created_at)}
                      </Typography>
                      {ticket.status === 'converted' && ticket.converted_at && (
                        <Typography variant="caption" color="success.main" display="block">
                          {translate('status.converted')}: {formatDateTime(ticket.converted_at)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                                               <IconButton
                           size="small"
                           onClick={(event) => {
                             event.stopPropagation();
                             handleMenuOpen(event, ticket);
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
        {ticketsData?.pagination && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={ticketsData.pagination.pages}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Modals */}
      <CreateWarrantyRepairTicketModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['warranty-repair-tickets'] });
        }}
      />

      {selectedTicket && (
        <>
          <EditWarrantyRepairTicketModal
            open={editModalOpen}
            ticket={selectedTicket}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedTicket(null);
            }}
            onSuccess={() => {
              setEditModalOpen(false);
              setSelectedTicket(null);
              queryClient.invalidateQueries({ queryKey: ['warranty-repair-tickets'] });
            }}
          />

          {/* Convert to Warranty Work Order Modal */}
          <Dialog 
            open={convertModalOpen} 
            onClose={() => setConvertModalOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>{translate('dialogs.convertToWarrantyWorkOrder')}</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 2 }}>
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
                        {technicians.isLoading ? (
                          <MenuItem disabled>
                            <em>{translate('common.loading')}...</em>
                          </MenuItem>
                        ) : technicians.error ? (
                          <MenuItem disabled>
                            <em>{translate('errors.failedToLoadTechnicians')}</em>
                          </MenuItem>
                        ) : (
                          technicians.data?.map((tech) => (
                            <MenuItem key={tech.id} value={tech.id}>
                              {tech.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
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
                      {translate('tableHeaders.priority')}
                    </InputLabel>
                    <Select
                      value={convertForm.priority}
                      onChange={(e) => setConvertForm({...convertForm, priority: e.target.value})}
                      label={translate('tableHeaders.priority')}
                      sx={{ 
                        minHeight: '56px',
                        '& .MuiSelect-select': {
                          paddingTop: '16px',
                          paddingBottom: '16px'
                        }
                      }}
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
                onClick={handleConvertSubmit}
                variant="contained"
                disabled={convertMutation.isLoading}
              >
                {convertMutation.isLoading ? <CircularProgress size={20} /> : translate('actions.convert')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

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
        
        {selectedTicketForMenu?.status === 'intake' && (
          <>
            <MenuItem onClick={() => handleMenuAction('edit')}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{translate('actions.edit')}</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => handleMenuAction('convert')}>
              <ListItemIcon>
                <ConvertIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{translate('actions.convertToWarrantyWorkOrder')}</ListItemText>
            </MenuItem>
            
            {(isAdmin || isManager || selectedTicketForMenu?.submitted_by === user?.id) && (
              <MenuItem onClick={() => handleMenuAction('delete')}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText sx={{ color: 'error.main' }}>{translate('actions.delete')}</ListItemText>
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </Box>
  );
};

export default WarrantyRepairTickets;
