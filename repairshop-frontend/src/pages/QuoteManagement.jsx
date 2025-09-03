import React, { useState, useCallback } from 'react';
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
  Badge,
  Tooltip,
  Menu,
  Alert,
  CircularProgress,
  InputAdornment,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  RequestQuote as QuoteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Visibility as ViewIcon,
  Check as AcceptIcon,
  Close as RejectIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  DateRange as DateRangeIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as ReportsIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const QUOTE_STATUSES = [
  { id: 'draft', name: 'Draft', color: '#757575' },
  { id: 'sent', name: 'Sent', color: '#2196f3' },
  { id: 'viewed', name: 'Viewed', color: '#ff9800' },
  { id: 'accepted', name: 'Accepted', color: '#4caf50' },
  { id: 'rejected', name: 'Rejected', color: '#f44336' },
  { id: 'expired', name: 'Expired', color: '#9e9e9e' },
  { id: 'converted', name: 'Converted to Sale', color: '#8bc34a' },
];

export default function QuoteManagement() {
  const { translate, formatDate } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDetailOpen, setQuoteDetailOpen] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [editQuoteOpen, setEditQuoteOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuQuote, setMenuQuote] = useState(null);

  // Form states for creating/editing quotes
  const [quoteForm, setQuoteForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    title: '',
    description: '',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    valid_until: '',
    notes: '',
    terms_conditions: '',
  });

  // Fetch quotes data
  const { data: quotes, isLoading: quotesLoading, refetch: refetchQuotes } = useQuery({
    queryKey: ['quotes', filterStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await api.get(`/quotes?${params.toString()}`);
      return response.data.data;
    },
  });

  // Fetch quote statistics
  const { data: quoteStats } = useQuery({
    queryKey: ['quote-stats'],
    queryFn: async () => {
      const response = await api.get('/quotes/stats');
      return response.data.data;
    },
  });

  // Fetch customers for quote creation
  const { data: customers } = useQuery({
    queryKey: ['customers-for-quotes'],
    queryFn: async () => {
      const response = await api.get('/customers?limit=100');
      return response.data.data;
    },
  });

  // Create quote mutation
  const createQuote = useMutation({
    mutationFn: (quoteData) => api.post('/quotes', quoteData),
    onSuccess: () => {
      queryClient.invalidateQueries(['quotes']);
      queryClient.invalidateQueries(['quote-stats']);
      setCreateQuoteOpen(false);
      resetQuoteForm();
      toast.success(translate('notifications.quoteCreated'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.createFailed'));
    }
  });

  // Update quote mutation
  const updateQuote = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/quotes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quotes']);
      queryClient.invalidateQueries(['quote-stats']);
      setEditQuoteOpen(false);
      toast.success(translate('notifications.quoteUpdated'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.updateFailed'));
    }
  });

  // Update quote status mutation
  const updateQuoteStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/quotes/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['quotes']);
      queryClient.invalidateQueries(['quote-stats']);
      toast.success(translate('notifications.quoteStatusUpdated'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.updateFailed'));
    }
  });

  // Delete quote mutation
  const deleteQuote = useMutation({
    mutationFn: (id) => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['quotes']);
      queryClient.invalidateQueries(['quote-stats']);
      toast.success(translate('notifications.quoteDeleted'));
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || translate('errors.deleteFailed'));
    }
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    const statusObj = QUOTE_STATUSES.find(s => s.id === status);
    return statusObj ? statusObj.color : '#757575';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft': return <DescriptionIcon />;
      case 'sent': return <SendIcon />;
      case 'viewed': return <ViewIcon />;
      case 'accepted': return <CheckCircleIcon />;
      case 'rejected': return <CancelIcon />;
      case 'expired': return <ScheduleIcon />;
      case 'converted': return <TrendingUpIcon />;
      default: return <DescriptionIcon />;
    }
  };

  const resetQuoteForm = () => {
    setQuoteForm({
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      title: '',
      description: '',
      items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
      valid_until: '',
      notes: '',
      terms_conditions: '',
    });
  };

  const calculateQuoteTotals = useCallback(() => {
    const subtotal = quoteForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = (subtotal * quoteForm.tax_rate) / 100;
    const totalAmount = subtotal + taxAmount - quoteForm.discount_amount;
    
    setQuoteForm(prev => ({
      ...prev,
      subtotal,
      tax_amount: taxAmount,
      total_amount: Math.max(0, totalAmount)
    }));
  }, [quoteForm.items, quoteForm.tax_rate, quoteForm.discount_amount]);

  const addQuoteItem = () => {
    setQuoteForm(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total: 0 }]
    }));
  };

  const removeQuoteItem = (index) => {
    setQuoteForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateQuoteItem = (index, field, value) => {
    setQuoteForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
      }
      return { ...prev, items: newItems };
    });
  };

  const handleQuoteClick = (quote) => {
    setSelectedQuote(quote);
    setQuoteDetailOpen(true);
  };

  const handleMenuOpen = (event, quote) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuQuote(quote);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuQuote(null);
  };

  const handleCreateQuote = () => {
    calculateQuoteTotals();
    createQuote.mutate(quoteForm);
  };

  const handleEditQuote = () => {
    calculateQuoteTotals();
    updateQuote.mutate({ id: selectedQuote.id, data: quoteForm });
  };

  const handleStatusUpdate = (quoteId, newStatus) => {
    updateQuoteStatus.mutate({ id: quoteId, status: newStatus });
    handleMenuClose();
  };

  const handleDeleteQuote = (quoteId) => {
    if (window.confirm(translate('confirmations.deleteQuote'))) {
      deleteQuote.mutate(quoteId);
    }
    handleMenuClose();
  };

  const handleSendQuote = async (quoteId) => {
    try {
      await api.post(`/quotes/${quoteId}/send`);
      updateQuoteStatus.mutate({ id: quoteId, status: 'sent' });
      toast.success(translate('notifications.quoteSent'));
    } catch (error) {
      toast.error(translate('errors.sendFailed'));
    }
    handleMenuClose();
  };

  const handlePrintQuote = (quoteId) => {
    window.open(`/api/quotes/${quoteId}/pdf`, '_blank');
    handleMenuClose();
  };

  // Statistics Cards Component
  const StatisticsCards = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <DescriptionIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" component="div">
              {quoteStats?.totalQuotes || 0}
            </Typography>
            <Typography color="textSecondary">
              {translate('common.totalQuotes')}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <MoneyIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" component="div">
              {formatCurrency(quoteStats?.totalValue)}
            </Typography>
            <Typography color="textSecondary">
              {translate('common.totalValue')}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" component="div">
              {quoteStats?.acceptanceRate || 0}%
            </Typography>
            <Typography color="textSecondary">
              {translate('common.acceptanceRate')}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <TrendingUpIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
            <Typography variant="h5" component="div">
              {quoteStats?.conversionRate || 0}%
            </Typography>
            <Typography color="textSecondary">
              {translate('common.conversionRate')}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Quote List Component
  const QuoteList = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{translate('forms.quoteNumber')}</TableCell>
            <TableCell>{translate('forms.customer')}</TableCell>
            <TableCell>{translate('forms.title')}</TableCell>
            <TableCell align="right">{translate('forms.amount')}</TableCell>
            <TableCell>{translate('forms.status')}</TableCell>
            <TableCell>{translate('forms.validUntil')}</TableCell>
            <TableCell>{translate('forms.createdAt')}</TableCell>
            <TableCell align="center">{translate('common.actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quotesLoading ? (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : quotes?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography color="textSecondary">
                  {translate('common.noQuotesFound')}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            quotes?.map((quote) => (
              <TableRow key={quote.id} hover onClick={() => handleQuoteClick(quote)} sx={{ cursor: 'pointer' }}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    Q-{quote.quote_number}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {quote.customer_name?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{quote.customer_name}</Typography>
                      {quote.customer_email && (
                        <Typography variant="caption" color="textSecondary">
                          {quote.customer_email}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{quote.title}</Typography>
                  {quote.description && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {quote.description.substring(0, 50)}...
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(quote.total_amount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(quote.status)}
                    label={translate(`quoteStatus.${quote.status}`)}
                    size="small"
                    sx={{ 
                      backgroundColor: getStatusColor(quote.status),
                      color: 'white',
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(quote.valid_until)}
                  </Typography>
                  {new Date(quote.valid_until) < new Date() && quote.status !== 'accepted' && quote.status !== 'converted' && (
                    <Chip label={translate('common.expired')} color="error" size="small" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(quote.created_at)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton 
                    size="small" 
                    onClick={(e) => handleMenuOpen(e, quote)}
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
  );

  // Create Quote Form Component
  const CreateQuoteForm = () => (
    <Dialog open={createQuoteOpen} onClose={() => setCreateQuoteOpen(false)} maxWidth="lg" fullWidth>
      <DialogTitle>{translate('actions.createQuote')}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Customer Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {translate('forms.customerInformation')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>{translate('forms.customer')}</InputLabel>
              <Select
                value={quoteForm.customer_id}
                onChange={(e) => {
                  const customer = customers?.find(c => c.id === e.target.value);
                  setQuoteForm(prev => ({
                    ...prev,
                    customer_id: e.target.value,
                    customer_name: customer?.name || '',
                    customer_email: customer?.email || '',
                    customer_phone: customer?.phone || ''
                  }));
                }}
                label={translate('forms.customer')}
              >
                {customers?.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={translate('forms.customerName')}
              value={quoteForm.customer_name}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, customer_name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={translate('forms.email')}
              type="email"
              value={quoteForm.customer_email}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, customer_email: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={translate('forms.phone')}
              value={quoteForm.customer_phone}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, customer_phone: e.target.value }))}
            />
          </Grid>

          {/* Quote Information */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              {translate('forms.quoteInformation')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={translate('forms.title')}
              value={quoteForm.title}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={translate('forms.validUntil')}
              type="date"
              value={quoteForm.valid_until}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, valid_until: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={translate('forms.description')}
              multiline
              rows={3}
              value={quoteForm.description}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </Grid>

          {/* Quote Items */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {translate('forms.quoteItems')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addQuoteItem}
                size="small"
              >
                {translate('actions.addItem')}
              </Button>
            </Box>
            {quoteForm.items.map((item, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label={translate('forms.description')}
                      value={item.description}
                      onChange={(e) => updateQuoteItem(index, 'description', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label={translate('forms.quantity')}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuoteItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label={translate('forms.unitPrice')}
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateQuoteItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      size="small"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label={translate('forms.total')}
                      value={formatCurrency(item.quantity * item.unit_price)}
                      InputProps={{ readOnly: true }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton
                      color="error"
                      onClick={() => removeQuoteItem(index)}
                      disabled={quoteForm.items.length === 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Grid>

          {/* Quote Totals */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2} justifyContent="flex-end">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label={translate('forms.taxRate')}
                  type="number"
                  value={quoteForm.tax_rate}
                  onChange={(e) => setQuoteForm(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label={translate('forms.discount')}
                  type="number"
                  value={quoteForm.discount_amount}
                  onChange={(e) => setQuoteForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">€</InputAdornment>,
                  }}
                  size="small"
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2">{translate('forms.subtotal')}:</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="body2">{formatCurrency(quoteForm.subtotal)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">{translate('forms.tax')}:</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="body2">{formatCurrency(quoteForm.tax_amount)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">{translate('forms.discount')}:</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="body2">-{formatCurrency(quoteForm.discount_amount)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6">{translate('forms.total')}:</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="h6">{formatCurrency(quoteForm.total_amount)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Additional Information */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={translate('forms.notes')}
              multiline
              rows={3}
              value={quoteForm.notes}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={translate('forms.termsConditions')}
              multiline
              rows={3}
              value={quoteForm.terms_conditions}
              onChange={(e) => setQuoteForm(prev => ({ ...prev, terms_conditions: e.target.value }))}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCreateQuoteOpen(false)}>
          {translate('actions.cancel')}
        </Button>
        <Button onClick={handleCreateQuote} variant="contained">
          {translate('actions.createQuote')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (quotesLoading) {
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
          <QuoteIcon />
          {translate('navigation.quoteManagement')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder={translate('common.searchQuotes')}
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
            <InputLabel>{translate('forms.status')}</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label={translate('forms.status')}
            >
              <MenuItem value="all">{translate('common.all')}</MenuItem>
              {QUOTE_STATUSES.map((status) => (
                <MenuItem key={status.id} value={status.id}>
                  {translate(`quoteStatus.${status.id}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refetchQuotes}
          >
            {translate('actions.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateQuoteOpen(true)}
          >
            {translate('actions.createQuote')}
          </Button>
        </Stack>
      </Box>

      {/* Statistics */}
      <StatisticsCards />

      {/* Quote List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {translate('common.quotes')}
          </Typography>
          <QuoteList />
        </CardContent>
      </Card>

      {/* Create Quote Dialog */}
      <CreateQuoteForm />

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleQuoteClick(menuQuote)}>
          <ViewIcon sx={{ mr: 1 }} />
          {translate('actions.view')}
        </MenuItem>
        <MenuItem onClick={() => handleSendQuote(menuQuote?.id)} disabled={menuQuote?.status === 'sent'}>
          <SendIcon sx={{ mr: 1 }} />
          {translate('actions.send')}
        </MenuItem>
        <MenuItem onClick={() => handlePrintQuote(menuQuote?.id)}>
          <PrintIcon sx={{ mr: 1 }} />
          {translate('actions.print')}
        </MenuItem>
        <MenuItem onClick={() => handleStatusUpdate(menuQuote?.id, 'accepted')} disabled={menuQuote?.status === 'accepted'}>
          <AcceptIcon sx={{ mr: 1 }} />
          {translate('actions.accept')}
        </MenuItem>
        <MenuItem onClick={() => handleStatusUpdate(menuQuote?.id, 'rejected')} disabled={menuQuote?.status === 'rejected'}>
          <RejectIcon sx={{ mr: 1 }} />
          {translate('actions.reject')}
        </MenuItem>
        <MenuItem onClick={() => handleDeleteQuote(menuQuote?.id)} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          {translate('actions.delete')}
        </MenuItem>
      </Menu>
    </Box>
  );
}
