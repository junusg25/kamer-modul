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
  LinearProgress,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
} from '@mui/material';
import {
  TrendingUp as SalesIcon,
  AttachMoney as MoneyIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Assessment as MetricsIcon,
  Star as OpportunityIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Business as BusinessIcon,
  Build as BuildIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function SalesDashboard() {
  const { translate, formatDate } = useLanguage();
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState('month');
  const [salesPersonFilter, setSalesPersonFilter] = useState('all');

  // Fetch sales metrics
  const { data: salesMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['sales-metrics', timeFilter],
    queryFn: async () => {
      const response = await api.get(`/analytics/sales-metrics?period=${timeFilter}`);
      return response.data.data;
    },
  });

  // Fetch sales opportunities
  const { data: salesOpportunities, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['sales-opportunities', salesPersonFilter],
    queryFn: async () => {
      const params = salesPersonFilter !== 'all' ? `?sales_user_id=${salesPersonFilter}` : '';
      const response = await api.get(`/analytics/sales-opportunities${params}`);
      return response.data.data;
    },
  });

  // Fetch sales team performance
  const { data: salesTeam, isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team-performance', timeFilter],
    queryFn: async () => {
      const response = await api.get(`/analytics/sales-team?period=${timeFilter}`);
      return response.data.data;
    },
  });

  // Fetch recent sales activities
  const { data: recentSales, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const response = await api.get('/analytics/recent-sales?limit=10');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <ArrowUpIcon fontSize="small" color="success" />;
    if (change < 0) return <ArrowDownIcon fontSize="small" color="error" />;
    return null;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SalesIcon />
          {translate('navigation.salesDashboard')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{translate('common.period')}</InputLabel>
            <Select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              label={translate('common.period')}
            >
              <MenuItem value="week">{translate('common.thisWeek')}</MenuItem>
              <MenuItem value="month">{translate('common.thisMonth')}</MenuItem>
              <MenuItem value="quarter">{translate('common.thisQuarter')}</MenuItem>
              <MenuItem value="year">{translate('common.thisYear')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('common.salesPerson')}</InputLabel>
            <Select
              value={salesPersonFilter}
              onChange={(e) => setSalesPersonFilter(e.target.value)}
              label={translate('common.salesPerson')}
            >
              <MenuItem value="all">{translate('common.all')}</MenuItem>
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
            onClick={() => {
              refetchMetrics();
            }}
          >
            {translate('actions.refresh')}
          </Button>
        </Stack>
      </Box>

      {/* Sales Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    {translate('common.totalSales')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    {salesMetrics?.totalSales || 0}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getChangeIcon(salesMetrics?.salesChange)}
                    <Typography variant="body2" color={salesMetrics?.salesChange >= 0 ? 'success.main' : 'error.main'}>
                      {Math.abs(salesMetrics?.salesChange || 0)}% vs {translate('common.lastPeriod')}
                    </Typography>
                  </Box>
                </Box>
                <StoreIcon sx={{ fontSize: 40, color: 'primary.main' }} />
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
                    {translate('common.totalRevenue')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    €{(salesMetrics?.totalRevenue || 0).toLocaleString()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getChangeIcon(salesMetrics?.revenueChange)}
                    <Typography variant="body2" color={salesMetrics?.revenueChange >= 0 ? 'success.main' : 'error.main'}>
                      {Math.abs(salesMetrics?.revenueChange || 0)}% vs {translate('common.lastPeriod')}
                    </Typography>
                  </Box>
                </Box>
                <MoneyIcon sx={{ fontSize: 40, color: 'success.main' }} />
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
                    {translate('common.avgSalePrice')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    €{(salesMetrics?.avgSalePrice || 0).toLocaleString()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getChangeIcon(salesMetrics?.avgPriceChange)}
                    <Typography variant="body2" color={salesMetrics?.avgPriceChange >= 0 ? 'success.main' : 'error.main'}>
                      {Math.abs(salesMetrics?.avgPriceChange || 0)}% vs {translate('common.lastPeriod')}
                    </Typography>
                  </Box>
                </Box>
                <MetricsIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                    {translate('common.salesOpportunities')}
                  </Typography>
                  <Typography variant="h5" component="div">
                    {salesOpportunities?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    €{(salesOpportunities?.reduce((sum, opp) => sum + (opp.potential_value || 0), 0) || 0).toLocaleString()} {translate('common.potential')}
                  </Typography>
                </Box>
                <OpportunityIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Sales Team Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon />
                {translate('common.salesTeamPerformance')}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{translate('common.salesPerson')}</TableCell>
                      <TableCell align="right">{translate('common.sales')}</TableCell>
                      <TableCell align="right">{translate('common.revenue')}</TableCell>
                      <TableCell align="right">{translate('common.target')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <LinearProgress />
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesTeam?.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {member.name.charAt(0)}
                              </Avatar>
                              <Typography variant="body2">{member.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{member.totalSales}</TableCell>
                          <TableCell align="right">€{(member.totalRevenue || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min((member.totalRevenue / member.target) * 100, 100)}
                                sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                              />
                              <Typography variant="caption">
                                {Math.round((member.totalRevenue / member.target) * 100)}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sales Opportunities */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <OpportunityIcon />
                {translate('common.salesOpportunities')}
              </Typography>
              <List dense>
                {opportunitiesLoading ? (
                  <ListItem>
                    <LinearProgress sx={{ width: '100%' }} />
                  </ListItem>
                ) : salesOpportunities?.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary={translate('common.noOpportunitiesFound')}
                      secondary={translate('common.allOpportunitiesConverted')}
                    />
                  </ListItem>
                ) : (
                  salesOpportunities?.slice(0, 5).map((opportunity) => (
                    <ListItem key={opportunity.id}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getStatusColor(opportunity.lead_quality) + '.main' }}>
                          <BusinessIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={opportunity.customer_name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {opportunity.description?.substring(0, 50)}...
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={`€${opportunity.potential_value}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <Chip
                                label={opportunity.lead_quality}
                                size="small"
                                color={getStatusColor(opportunity.lead_quality)}
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Tooltip title={translate('actions.call')}>
                          <IconButton size="small">
                            <PhoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={translate('actions.email')}>
                          <IconButton size="small">
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItem>
                  ))
                )}
              </List>
              {salesOpportunities?.length > 5 && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button size="small" variant="outlined">
                    {translate('actions.viewAll')} ({salesOpportunities.length - 5} {translate('common.more')})
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Sales Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon />
                {translate('common.recentSalesActivity')}
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{translate('common.date')}</TableCell>
                      <TableCell>{translate('common.customer')}</TableCell>
                      <TableCell>{translate('common.machine')}</TableCell>
                      <TableCell>{translate('common.salesPerson')}</TableCell>
                      <TableCell align="right">{translate('common.amount')}</TableCell>
                      <TableCell>{translate('common.status')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <LinearProgress />
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentSales?.map((sale) => (
                        <TableRow key={sale.id} hover>
                          <TableCell>{formatDate(sale.sale_date)}</TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {sale.customer_name}
                              </Typography>
                              {sale.company_name && (
                                <Typography variant="caption" color="textSecondary">
                                  {sale.company_name}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{sale.model_name}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                SN: {sale.serial_number}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{sale.sold_by_name}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              €{parseFloat(sale.sale_price).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={translate('common.completed')}
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
