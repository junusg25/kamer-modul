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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import {
  Assessment as ReportsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
  DateRange as DateRangeIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  Group as TeamIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function SalesReports() {
  const { translate, formatDate } = useLanguage();
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('month');
  const [salesPersonFilter, setSalesPersonFilter] = useState('all');

  // Fetch sales analytics data
  const { data: salesAnalytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['sales-analytics', timeRange, salesPersonFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', timeRange);
      if (salesPersonFilter !== 'all') params.append('sales_person', salesPersonFilter);
      
      const response = await api.get(`/analytics/sales-reports?${params.toString()}`);
      return response.data.data;
    },
  });

  // Fetch sales trends data
  const { data: salesTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['sales-trends', timeRange],
    queryFn: async () => {
      const response = await api.get(`/analytics/sales-trends?period=${timeRange}`);
      return response.data.data;
    },
  });

  // Fetch team performance data
  const { data: teamPerformance, isLoading: teamLoading } = useQuery({
    queryKey: ['team-performance', timeRange],
    queryFn: async () => {
      const response = await api.get(`/analytics/team-performance?period=${timeRange}`);
      return response.data.data;
    },
  });

  // Fetch conversion funnel data
  const { data: conversionFunnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['conversion-funnel', timeRange],
    queryFn: async () => {
      const response = await api.get(`/analytics/conversion-funnel?period=${timeRange}`);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.secondary';
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <TrendingUpIcon fontSize="small" />;
    if (change < 0) return <TrendingDownIcon fontSize="small" />;
    return null;
  };

  const handleExportReport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('period', timeRange);
      if (salesPersonFilter !== 'all') params.append('sales_person', salesPersonFilter);
      
      const response = await api.get(`/analytics/sales-reports/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales-report-${timeRange}-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Overview Tab Content
  const OverviewTab = () => (
    <Grid container spacing={3}>
      {/* Key Metrics Cards */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  {translate('common.totalRevenue')}
                </Typography>
                <Typography variant="h5" component="div">
                  {formatCurrency(salesAnalytics?.totalRevenue)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {getChangeIcon(salesAnalytics?.revenueChange)}
                  <Typography variant="body2" sx={{ color: getChangeColor(salesAnalytics?.revenueChange) }}>
                    {Math.abs(salesAnalytics?.revenueChange || 0)}% vs {translate('common.lastPeriod')}
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
                  {translate('common.totalSales')}
                </Typography>
                <Typography variant="h5" component="div">
                  {salesAnalytics?.totalSales || 0}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {getChangeIcon(salesAnalytics?.salesChange)}
                  <Typography variant="body2" sx={{ color: getChangeColor(salesAnalytics?.salesChange) }}>
                    {Math.abs(salesAnalytics?.salesChange || 0)}% vs {translate('common.lastPeriod')}
                  </Typography>
                </Box>
              </Box>
              <CheckCircleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
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
                  {formatCurrency(salesAnalytics?.avgSalePrice)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {getChangeIcon(salesAnalytics?.avgPriceChange)}
                  <Typography variant="body2" sx={{ color: getChangeColor(salesAnalytics?.avgPriceChange) }}>
                    {Math.abs(salesAnalytics?.avgPriceChange || 0)}% vs {translate('common.lastPeriod')}
                  </Typography>
                </Box>
              </Box>
              <TimelineIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                  {formatPercentage(salesAnalytics?.conversionRate)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {getChangeIcon(salesAnalytics?.conversionChange)}
                  <Typography variant="body2" sx={{ color: getChangeColor(salesAnalytics?.conversionChange) }}>
                    {Math.abs(salesAnalytics?.conversionChange || 0)}% vs {translate('common.lastPeriod')}
                  </Typography>
                </Box>
              </Box>
              <StarIcon sx={{ fontSize: 40, color: 'warning.main' }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Sales Trends Chart */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LineChartIcon />
              {translate('common.salesTrends')}
            </Typography>
            {trendsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip formatter={(value, name) => [formatCurrency(value), translate(`common.${name}`)]} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stackId="2"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Conversion Funnel */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PieChartIcon />
              {translate('common.conversionFunnel')}
            </Typography>
            {funnelLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List dense>
                {conversionFunnel?.map((stage, index) => (
                  <ListItem key={stage.stage} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            {translate(`stages.${stage.stage}`)}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {stage.count} ({formatPercentage(stage.percentage)})
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <LinearProgress
                          variant="determinate"
                          value={stage.percentage}
                          sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        />
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Top Performers */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamIcon />
              {translate('common.topPerformers')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{translate('common.salesPerson')}</TableCell>
                    <TableCell align="right">{translate('common.sales')}</TableCell>
                    <TableCell align="right">{translate('common.revenue')}</TableCell>
                    <TableCell align="right">{translate('common.avgDealSize')}</TableCell>
                    <TableCell align="right">{translate('common.conversionRate')}</TableCell>
                    <TableCell align="right">{translate('common.performance')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamPerformance?.map((member) => (
                      <TableRow key={member.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              {member.name?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">{member.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">{member.totalSales}</TableCell>
                        <TableCell align="right">{formatCurrency(member.totalRevenue)}</TableCell>
                        <TableCell align="right">{formatCurrency(member.avgDealSize)}</TableCell>
                        <TableCell align="right">{formatPercentage(member.conversionRate)}</TableCell>
                        <TableCell align="right">
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((member.totalRevenue / member.target) * 100, 100)}
                            sx={{ width: 100, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            {Math.round((member.totalRevenue / member.target) * 100)}% of target
                          </Typography>
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
  );

  // Sales Trends Tab Content
  const TrendsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {translate('common.revenueByMonth')}
            </Typography>
            {trendsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {translate('common.salesByStage')}
            </Typography>
            {funnelLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={conversionFunnel}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ stage, percentage }) => `${translate(`stages.${stage}`)} ${formatPercentage(percentage)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {conversionFunnel?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {translate('common.salesTrendAnalysis')}
            </Typography>
            {trendsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
                  <Line yAxisId="right" type="monotone" dataKey="sales" stroke="#82ca9d" name="Sales Count" />
                  <Line yAxisId="left" type="monotone" dataKey="avgDealSize" stroke="#ffc658" name="Avg Deal Size" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Team Performance Tab Content
  const TeamTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {translate('common.teamPerformanceComparison')}
            </Typography>
            {teamLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={teamPerformance} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="totalRevenue" fill="#8884d8" name="Revenue" />
                  <Bar dataKey="target" fill="#82ca9d" name="Target" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {translate('common.detailedTeamMetrics')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{translate('common.salesPerson')}</TableCell>
                    <TableCell align="right">{translate('common.leadsGenerated')}</TableCell>
                    <TableCell align="right">{translate('common.leadsConverted')}</TableCell>
                    <TableCell align="right">{translate('common.conversionRate')}</TableCell>
                    <TableCell align="right">{translate('common.avgDealSize')}</TableCell>
                    <TableCell align="right">{translate('common.totalRevenue')}</TableCell>
                    <TableCell align="right">{translate('common.targetAchievement')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamPerformance?.map((member) => (
                    <TableRow key={member.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {member.name?.charAt(0)}
                          </Avatar>
                          <Typography variant="body2">{member.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{member.leadsGenerated}</TableCell>
                      <TableCell align="right">{member.leadsConverted}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={formatPercentage(member.conversionRate)}
                          color={member.conversionRate > 20 ? 'success' : member.conversionRate > 10 ? 'warning' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(member.avgDealSize)}</TableCell>
                      <TableCell align="right">{formatCurrency(member.totalRevenue)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${Math.round((member.totalRevenue / member.target) * 100)}%`}
                          color={member.totalRevenue >= member.target ? 'success' : member.totalRevenue >= member.target * 0.8 ? 'warning' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportsIcon />
          {translate('navigation.salesReports')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{translate('common.period')}</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
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
            onClick={refetchAnalytics}
          >
            {translate('actions.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportReport}
          >
            {translate('actions.export')}
          </Button>
        </Stack>
      </Box>

      {/* Report Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={translate('common.overview')} />
          <Tab label={translate('common.trends')} />
          <Tab label={translate('common.teamPerformance')} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && <OverviewTab />}
        {activeTab === 1 && <TrendsTab />}
        {activeTab === 2 && <TeamTab />}
      </Box>
    </Box>
  );
}
