import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Tooltip,
  Badge,
  Tab,
  Tabs,
  Menu,
  Alert,
  CircularProgress,
  InputAdornment,
  Fab,
} from '@mui/material';
import {
  Star as LeadIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Event as EventIcon,
  Notes as NotesIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CallMade as CallIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Assignment as TaskIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Build as ServiceIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function LeadManagement() {
  const { translate, formatDate } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // Form state
  const [leadForm, setLeadForm] = useState({
    customer_name: '',
    company_name: '',
    email: '',
    phone: '',
    source: '',
    lead_quality: 'medium',
    potential_value: '',
    sales_stage: 'new',
    sales_notes: '',
    next_follow_up: '',
    assigned_to: user?.id || ''
  });

  const [followUpForm, setFollowUpForm] = useState({
    notes: '',
    next_follow_up: '',
    action_taken: '',
    outcome: ''
  });

  // Fetch leads data
  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', searchQuery, statusFilter, qualityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (qualityFilter !== 'all') params.append('quality', qualityFilter);
      
      const response = await api.get(`/leads?${params.toString()}`);
      return response.data.data;
    },
  });

  // Fetch lead statistics
  const { data: leadStats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const response = await api.get('/leads/statistics');
      return response.data.data;
    },
  });

  // Fetch sales users
  const { data: salesUsers } = useQuery({
    queryKey: ['sales-users'],
    queryFn: async () => {
      const response = await api.get('/users/sales');
      return response.data.data;
    },
  });

  // Create lead mutation
  const createLead = useMutation({
    mutationFn: (leadData) => api.post('/leads', leadData),
    onSuccess: () => {
      toast.success(translate('notifications.leadCreated'));
      setLeadDialogOpen(false);
      setLeadForm({
        customer_name: '',
        company_name: '',
        email: '',
        phone: '',
        source: '',
        lead_quality: 'medium',
        potential_value: '',
        sales_stage: 'new',
        sales_notes: '',
        next_follow_up: '',
        assigned_to: user?.id || ''
      });
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-stats']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.createFailed'));
    }
  });

  // Update lead mutation
  const updateLead = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/leads/${id}`, data),
    onSuccess: () => {
      toast.success(translate('notifications.leadUpdated'));
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-stats']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.updateFailed'));
    }
  });

  // Add follow-up mutation
  const addFollowUp = useMutation({
    mutationFn: ({ leadId, ...data }) => api.post(`/leads/${leadId}/follow-ups`, data),
    onSuccess: () => {
      toast.success(translate('notifications.followUpAdded'));
      setFollowUpDialogOpen(false);
      setFollowUpForm({
        notes: '',
        next_follow_up: '',
        action_taken: '',
        outcome: ''
      });
      queryClient.invalidateQueries(['leads']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.createFailed'));
    }
  });

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'new': return 'info';
      case 'contacted': return 'primary';
      case 'qualified': return 'warning';
      case 'proposal': return 'secondary';
      case 'negotiation': return 'warning';
      case 'won': return 'success';
      case 'lost': return 'error';
      default: return 'default';
    }
  };

  const handleCreateLead = () => {
    createLead.mutate(leadForm);
  };

  const handleUpdateStage = (leadId, newStage) => {
    updateLead.mutate({ id: leadId, sales_stage: newStage });
    setMenuAnchorEl(null);
  };

  const handleAddFollowUp = () => {
    if (selectedLead) {
      addFollowUp.mutate({ leadId: selectedLead.id, ...followUpForm });
    }
  };

  const filteredLeads = leads?.filter(lead => {
    if (activeTab === 0) return true; // All leads
    if (activeTab === 1) return lead.sales_stage === 'new';
    if (activeTab === 2) return ['contacted', 'qualified'].includes(lead.sales_stage);
    if (activeTab === 3) return ['proposal', 'negotiation'].includes(lead.sales_stage);
    if (activeTab === 4) return lead.sales_stage === 'won';
    return true;
  }) || [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LeadIcon />
          {translate('navigation.leadManagement')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder={translate('common.searchLeads')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{translate('common.quality')}</InputLabel>
            <Select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              label={translate('common.quality')}
            >
              <MenuItem value="all">{translate('common.all')}</MenuItem>
              <MenuItem value="high">{translate('common.high')}</MenuItem>
              <MenuItem value="medium">{translate('common.medium')}</MenuItem>
              <MenuItem value="low">{translate('common.low')}</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refetch}
          >
            {translate('actions.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setLeadDialogOpen(true)}
          >
            {translate('actions.addLead')}
          </Button>
        </Stack>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    {translate('common.totalLeads')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    {leadStats?.totalLeads || 0}
                  </Typography>
                </Box>
                <LeadIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    {translate('common.qualifiedLeads')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    {leadStats?.qualifiedLeads || 0}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    {translate('common.conversionRate')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    {leadStats?.conversionRate || 0}%
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    {translate('common.totalPotentialValue')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    €{(leadStats?.totalPotentialValue || 0).toLocaleString()}
                  </Typography>
                </Box>
                <MoneyIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Lead Pipeline Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`${translate('common.allLeads')} (${leads?.length || 0})`} />
          <Tab label={`${translate('common.newLeads')} (${leads?.filter(l => l.sales_stage === 'new').length || 0})`} />
          <Tab label={`${translate('common.inProgress')} (${leads?.filter(l => ['contacted', 'qualified'].includes(l.sales_stage)).length || 0})`} />
          <Tab label={`${translate('common.closingStage')} (${leads?.filter(l => ['proposal', 'negotiation'].includes(l.sales_stage)).length || 0})`} />
          <Tab label={`${translate('common.wonDeals')} (${leads?.filter(l => l.sales_stage === 'won').length || 0})`} />
        </Tabs>
      </Paper>

      {/* Leads Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{translate('forms.customerName')}</TableCell>
                <TableCell>{translate('forms.companyName')}</TableCell>
                <TableCell>{translate('common.contact')}</TableCell>
                <TableCell>{translate('common.source')}</TableCell>
                <TableCell>{translate('common.quality')}</TableCell>
                <TableCell>{translate('common.stage')}</TableCell>
                <TableCell>{translate('common.potentialValue')}</TableCell>
                <TableCell>{translate('common.assignedTo')}</TableCell>
                <TableCell>{translate('common.nextFollowUp')}</TableCell>
                <TableCell>{translate('tableHeaders.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography color="textSecondary">
                      {translate('common.noLeadsFound')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {lead.customer_name?.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" fontWeight="medium">
                          {lead.customer_name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{lead.company_name || '-'}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {lead.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon fontSize="small" color="action" />
                            <Typography variant="caption">{lead.email}</Typography>
                          </Box>
                        )}
                        {lead.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="caption">{lead.phone}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lead.source || translate('common.unknown')}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={translate(`common.${lead.lead_quality}`)}
                        color={getQualityColor(lead.lead_quality)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={translate(`stages.${lead.sales_stage}`)}
                        color={getStageColor(lead.sales_stage)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        €{parseFloat(lead.potential_value || 0).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {lead.assigned_to_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {lead.next_follow_up ? (
                        <Box>
                          <Typography variant="body2">
                            {formatDate(lead.next_follow_up)}
                          </Typography>
                          <Chip
                            label={new Date(lead.next_follow_up) < new Date() ? translate('common.overdue') : translate('common.upcoming')}
                            color={new Date(lead.next_follow_up) < new Date() ? 'error' : 'warning'}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={translate('actions.call')}>
                          <IconButton size="small" disabled={!lead.phone}>
                            <PhoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('actions.email')}>
                          <IconButton size="small" disabled={!lead.email}>
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('actions.addFollowUp')}>
                          <IconButton 
                            size="small"
                            onClick={() => {
                              setSelectedLead(lead);
                              setFollowUpDialogOpen(true);
                            }}
                          >
                            <EventIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('actions.updateStage')}>
                          <IconButton 
                            size="small"
                            onClick={(e) => {
                              setMenuAnchorEl(e.currentTarget);
                              setSelectedLead(lead);
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Stage Update Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map((stage) => (
          <MenuItem 
            key={stage}
            onClick={() => handleUpdateStage(selectedLead?.id, stage)}
            disabled={selectedLead?.sales_stage === stage}
          >
            <Chip
              label={translate(`stages.${stage}`)}
              color={getStageColor(stage)}
              size="small"
              variant="outlined"
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Create Lead Dialog */}
      <Dialog open={leadDialogOpen} onClose={() => setLeadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{translate('actions.addLead')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.customerName')}
                value={leadForm.customer_name}
                onChange={(e) => setLeadForm(prev => ({ ...prev, customer_name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.companyName')}
                value={leadForm.company_name}
                onChange={(e) => setLeadForm(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.email')}
                type="email"
                value={leadForm.email}
                onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('forms.phone')}
                value={leadForm.phone}
                onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('common.source')}
                value={leadForm.source}
                onChange={(e) => setLeadForm(prev => ({ ...prev, source: e.target.value }))}
                placeholder={translate('common.sourceExample')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{translate('common.quality')}</InputLabel>
                <Select
                  value={leadForm.lead_quality}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, lead_quality: e.target.value }))}
                  label={translate('common.quality')}
                >
                  <MenuItem value="high">{translate('common.high')}</MenuItem>
                  <MenuItem value="medium">{translate('common.medium')}</MenuItem>
                  <MenuItem value="low">{translate('common.low')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={translate('common.potentialValue')}
                type="number"
                value={leadForm.potential_value}
                onChange={(e) => setLeadForm(prev => ({ ...prev, potential_value: e.target.value }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">€</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{translate('common.assignTo')}</InputLabel>
                <Select
                  value={leadForm.assigned_to}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  label={translate('common.assignTo')}
                >
                  {salesUsers?.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.notes')}
                multiline
                rows={3}
                value={leadForm.sales_notes}
                onChange={(e) => setLeadForm(prev => ({ ...prev, sales_notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.nextFollowUp')}
                type="datetime-local"
                value={leadForm.next_follow_up}
                onChange={(e) => setLeadForm(prev => ({ ...prev, next_follow_up: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadDialogOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={handleCreateLead} 
            variant="contained"
            disabled={createLead.isLoading || !leadForm.customer_name}
          >
            {createLead.isLoading ? <CircularProgress size={20} /> : translate('actions.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={followUpDialogOpen} onClose={() => setFollowUpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{translate('actions.addFollowUp')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.actionTaken')}
                value={followUpForm.action_taken}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, action_taken: e.target.value }))}
                placeholder={translate('common.actionTakenExample')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.notes')}
                multiline
                rows={3}
                value={followUpForm.notes}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, notes: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.outcome')}
                value={followUpForm.outcome}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, outcome: e.target.value }))}
                placeholder={translate('common.outcomeExample')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={translate('common.nextFollowUp')}
                type="datetime-local"
                value={followUpForm.next_follow_up}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, next_follow_up: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFollowUpDialogOpen(false)}>
            {translate('actions.cancel')}
          </Button>
          <Button 
            onClick={handleAddFollowUp} 
            variant="contained"
            disabled={addFollowUp.isLoading || !followUpForm.notes}
          >
            {addFollowUp.isLoading ? <CircularProgress size={20} /> : translate('actions.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
