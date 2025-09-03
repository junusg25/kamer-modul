import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Chip,
  Avatar,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Badge,
  Tooltip,
  Menu,
  Alert,
  CircularProgress,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import {
  Timeline as PipelineIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  Star as StarIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  DragIndicator as DragIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  CalendarToday as CalendarIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const PIPELINE_STAGES = [
  { id: 'new', name: 'New Leads', color: '#2196f3' },
  { id: 'contacted', name: 'Contacted', color: '#ff9800' },
  { id: 'qualified', name: 'Qualified', color: '#9c27b0' },
  { id: 'proposal', name: 'Proposal', color: '#3f51b5' },
  { id: 'negotiation', name: 'Negotiation', color: '#f44336' },
  { id: 'won', name: 'Won', color: '#4caf50' },
  { id: 'lost', name: 'Lost', color: '#757575' },
];

export default function SalesPipeline() {
  const { translate, formatDate } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [filterBy, setFilterBy] = useState('all');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuLead, setMenuLead] = useState(null);

  // Fetch leads data grouped by stage
  const { data: pipelineData, isLoading, refetch } = useQuery({
    queryKey: ['pipeline-leads', filterBy],
    queryFn: async () => {
      const params = filterBy !== 'all' ? `?assigned_to=${filterBy}` : '';
      const response = await api.get(`/leads/pipeline${params}`);
      return response.data.data;
    },
  });

  // Fetch pipeline statistics
  const { data: pipelineStats } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: async () => {
      const response = await api.get('/leads/pipeline-stats');
      return response.data.data;
    },
  });

  // Fetch sales users for filter
  const { data: salesUsers } = useQuery({
    queryKey: ['sales-users'],
    queryFn: async () => {
      const response = await api.get('/users/sales');
      return response.data.data;
    },
  });

  // Update lead stage mutation
  const updateLeadStage = useMutation({
    mutationFn: ({ leadId, newStage, newPosition }) => 
      api.patch(`/leads/${leadId}/stage`, { 
        sales_stage: newStage, 
        pipeline_position: newPosition 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pipeline-leads']);
      queryClient.invalidateQueries(['pipeline-stats']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.updateFailed'));
    }
  });

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const leadId = parseInt(draggableId);
    const newStage = destination.droppableId;
    const newPosition = destination.index;

    // Don't update if dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Optimistically update the UI
    queryClient.setQueryData(['pipeline-leads', filterBy], (oldData) => {
      if (!oldData) return oldData;

      const newData = { ...oldData };
      const lead = oldData[source.droppableId]?.find(l => l.id === leadId);
      
      if (lead) {
        // Remove from source
        newData[source.droppableId] = oldData[source.droppableId].filter(l => l.id !== leadId);
        
        // Add to destination
        if (!newData[destination.droppableId]) {
          newData[destination.droppableId] = [];
        }
        const updatedLead = { ...lead, sales_stage: newStage };
        newData[destination.droppableId].splice(newPosition, 0, updatedLead);
      }

      return newData;
    });

    // Make API call
    updateLeadStage.mutate({ leadId, newStage, newPosition });
  }, [updateLeadStage, queryClient, filterBy]);

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
  };

  const handleMenuOpen = (event, lead) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuLead(lead);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuLead(null);
  };

  const LeadCard = ({ lead, index }) => (
    <Draggable draggableId={lead.id.toString()} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          sx={{
            mb: 1,
            cursor: 'pointer',
            backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper',
            transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
            boxShadow: snapshot.isDragging ? 4 : 1,
            '&:hover': {
              boxShadow: 2,
            }
          }}
          onClick={() => handleLeadClick(lead)}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Box {...provided.dragHandleProps}>
                  <DragIcon sx={{ color: 'text.secondary', cursor: 'grab' }} />
                </Box>
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                  {lead.customer_name?.charAt(0)}
                </Avatar>
                <Typography variant="body2" fontWeight="bold" noWrap>
                  {lead.customer_name}
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={(e) => handleMenuOpen(e, lead)}
                sx={{ ml: 1 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>

            {lead.company_name && (
              <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                <BusinessIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                {lead.company_name}
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Chip
                label={translate(`common.${lead.lead_quality}`)}
                color={getQualityColor(lead.lead_quality)}
                size="small"
                sx={{ fontSize: '0.6rem', height: 20 }}
              />
              <Typography variant="body2" fontWeight="bold" color="primary.main">
                {formatCurrency(lead.potential_value)}
              </Typography>
            </Box>

            {lead.next_follow_up && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="textSecondary">
                  {formatDate(lead.next_follow_up)}
                </Typography>
                {new Date(lead.next_follow_up) < new Date() && (
                  <Chip label={translate('common.overdue')} color="error" size="small" sx={{ fontSize: '0.6rem', height: 16 }} />
                )}
              </Box>
            )}

            {lead.assigned_to_name && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <PersonIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="textSecondary">
                  {lead.assigned_to_name}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Draggable>
  );

  const PipelineColumn = ({ stage, leads = [] }) => (
    <Paper sx={{ p: 2, minHeight: '70vh', backgroundColor: 'grey.50' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: stage.color,
            }}
          />
          {translate(`stages.${stage.id}`)}
        </Typography>
        <Badge badgeContent={leads.length} color="primary">
          <Box />
        </Badge>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="textSecondary">
          {translate('common.totalValue')}: {formatCurrency(
            leads.reduce((sum, lead) => sum + (lead.potential_value || 0), 0)
          )}
        </Typography>
      </Box>

      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              minHeight: '60vh',
              backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
              borderRadius: 1,
              p: 1,
              border: snapshot.isDraggingOver ? '2px dashed' : '2px solid transparent',
              borderColor: snapshot.isDraggingOver ? 'primary.main' : 'transparent',
            }}
          >
            {leads.map((lead, index) => (
              <LeadCard key={lead.id} lead={lead} index={index} />
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Paper>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PipelineIcon />
          {translate('navigation.salesPipeline')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('common.filterBy')}</InputLabel>
            <Select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              label={translate('common.filterBy')}
            >
              <MenuItem value="all">{translate('common.allSalespeople')}</MenuItem>
              {salesUsers?.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refetch}
          >
            {translate('actions.refresh')}
          </Button>
        </Stack>
      </Box>

      {/* Pipeline Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h5" component="div">
                {pipelineStats?.totalLeads || 0}
              </Typography>
              <Typography color="textSecondary">
                {translate('common.totalLeads')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <MoneyIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h5" component="div">
                {formatCurrency(pipelineStats?.totalValue)}
              </Typography>
              <Typography color="textSecondary">
                {translate('common.pipelineValue')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h5" component="div">
                {pipelineStats?.conversionRate || 0}%
              </Typography>
              <Typography color="textSecondary">
                {translate('common.conversionRate')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h5" component="div">
                {pipelineStats?.overdueFollowUps || 0}
              </Typography>
              <Typography color="textSecondary">
                {translate('common.overdueFollowUps')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pipeline Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Grid container spacing={2} sx={{ minWidth: '1400px' }}>
            {PIPELINE_STAGES.map((stage) => (
              <Grid item xs={12/7} key={stage.id}>
                <PipelineColumn
                  stage={stage}
                  leads={pipelineData?.[stage.id] || []}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </DragDropContext>

      {/* Lead Detail Dialog */}
      <Dialog 
        open={leadDetailOpen} 
        onClose={() => setLeadDetailOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {translate('common.leadDetails')}
        </DialogTitle>
        <DialogContent>
          {selectedLead && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('forms.customerName')}
                  value={selectedLead.customer_name}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('forms.companyName')}
                  value={selectedLead.company_name || ''}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('forms.email')}
                  value={selectedLead.email || ''}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('forms.phone')}
                  value={selectedLead.phone || ''}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('common.source')}
                  value={selectedLead.source || ''}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('common.potentialValue')}
                  value={formatCurrency(selectedLead.potential_value)}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('common.quality')}
                  value={translate(`common.${selectedLead.lead_quality}`)}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={translate('common.assignedTo')}
                  value={selectedLead.assigned_to_name || ''}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              {selectedLead.next_follow_up && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={translate('common.nextFollowUp')}
                    value={formatDate(selectedLead.next_follow_up)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              )}
              {selectedLead.sales_notes && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={translate('common.notes')}
                    multiline
                    rows={3}
                    value={selectedLead.sales_notes}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadDetailOpen(false)}>
            {translate('actions.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (menuLead?.phone) {
            window.open(`tel:${menuLead.phone}`);
          }
          handleMenuClose();
        }} disabled={!menuLead?.phone}>
          <PhoneIcon sx={{ mr: 1 }} />
          {translate('actions.call')}
        </MenuItem>
        <MenuItem onClick={() => {
          if (menuLead?.email) {
            window.open(`mailto:${menuLead.email}`);
          }
          handleMenuClose();
        }} disabled={!menuLead?.email}>
          <EmailIcon sx={{ mr: 1 }} />
          {translate('actions.email')}
        </MenuItem>
        <MenuItem onClick={() => {
          handleLeadClick(menuLead);
          handleMenuClose();
        }}>
          <NotesIcon sx={{ mr: 1 }} />
          {translate('actions.viewDetails')}
        </MenuItem>
      </Menu>
    </Box>
  );
}
