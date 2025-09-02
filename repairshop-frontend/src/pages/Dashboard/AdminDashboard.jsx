import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Paper,
  Container,
  Divider,
  Chip,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  AttachMoney,
  Work,
  Build,
  ConfirmationNumber,
  TrendingUp,
  TrendingDown,
  MoreVert,
  Assignment,
  CheckCircle,
  Schedule,
  Warning,
  Person,
  Inventory,
  Speed
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  StatCard,
  RecentActivity,
  MostUsedParts,
  MostRepairedMachines,
  TechnicianWorkload
} from './components';
import {
  useDashboardData,
  useTechnicianWorkload
} from './hooks/useDashboardData';

export default function AdminDashboard() {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data fetching
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData();
  const { data: technicianWorkload, isLoading: workloadLoading, error: workloadError } = useTechnicianWorkload();





  // Error handling
  if (dashboardError) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {translate('dashboard.dataLoadingError')}
        </Alert>
      </Container>
    );
  }

  // Loading state
  if (dashboardLoading || workloadLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Extract admin stats from dashboard data
  const getAdminStats = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const workOrders = data.work_orders || {};
    const performance = data.performance || {};
    const customers = data.customers || {};
    const technicians = data.technicians || {};


    
    return [
      {
                        title: translate('dashboard.totalRevenue'),
                value: `$${(parseFloat(workOrders.total_revenue) || 0).toLocaleString()}`,
                subtitle: translate('dashboard.fromCompletedWorkOrders'),
        icon: <AttachMoney />,
        color: '#2e7d32',
        trend: '+12%',
        trendDirection: 'up',
        onClick: () => navigate('/non-warranty?tab=work-orders&status=completed'),
        linkText: translate('dashboard.viewCompletedWorkOrders')
      },
      {
        title: translate('dashboard.workOrders'),
        value: (parseInt(workOrders.pending_orders || 0) + parseInt(workOrders.active_orders || 0) + parseInt(workOrders.completed_orders || 0)).toString(),
        subtitle: `${parseInt(workOrders.active_orders || 0)} ${translate('dashboard.active')}`,
        icon: <Work />,
        color: '#1976d2',
        trend: '+5%',
        trendDirection: 'up',
        onClick: () => navigate('/non-warranty?tab=work-orders'),
        linkText: translate('dashboard.viewAllWorkOrders')
      },
      {
        title: translate('dashboard.warrantyWorkOrders'),
        value: (parseInt(workOrders.warranty_pending_orders || 0) + parseInt(workOrders.warranty_active_orders || 0) + parseInt(workOrders.warranty_completed_orders || 0)).toString(),
        subtitle: `${parseInt(workOrders.warranty_active_orders || 0)} ${translate('dashboard.active')}`,
        icon: <Build />,
        color: '#ed6c02',
        trend: '-2%',
        trendDirection: 'down',
        onClick: () => navigate('/warranty?tab=warranty-work-orders'),
        linkText: translate('dashboard.viewAllWarrantyWorkOrders')
      },
      {
        title: translate('dashboard.warrantyRepairTickets'),
        value: (parseInt(workOrders.warranty_repair_tickets_intake || 0) + parseInt(workOrders.warranty_repair_tickets_converted || 0)).toString(),
        subtitle: `${parseInt(workOrders.warranty_repair_tickets_intake || 0)} ${translate('dashboard.intake')}`,
        icon: <ConfirmationNumber />,
        color: '#9c27b0',
        trend: '+8%',
        trendDirection: 'up',
        onClick: () => navigate('/warranty?tab=warranty-repair-tickets'),
        linkText: translate('dashboard.viewAllWarrantyRepairTickets')
      }
    ];
  };

  const getPerformanceMetrics = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const performance = data.performance || {};
    const workOrders = data.work_orders || {};
    const customers = data.customers || {};
    const technicians = data.technicians || {};

    return [
      {
        title: translate('dashboard.completionRate'),
        value: `${parseFloat(performance.work_order_completion_rate || 0).toFixed(1)}%`,
        subtitle: translate('dashboard.workOrderCompletion'),
        icon: <CheckCircle />,
        color: '#2e7d32'
      },
      {
        title: translate('dashboard.avgCompletionTime'),
        value: `${Math.round(parseFloat(performance.avg_completion_hours || 0))}h`,
        subtitle: translate('dashboard.averagePerOrder'),
        icon: <Speed />,
        color: '#1976d2'
      },
      {
        title: translate('dashboard.activeCustomers'),
        value: parseInt(customers.active_customers || 0).toString(),
        subtitle: translate('dashboard.last30Days'),
        icon: <Person />,
        color: '#ed6c02'
      },
      {
        title: translate('dashboard.activeTechnicians'),
        value: parseInt(technicians.active_technicians || 0).toString(),
        subtitle: translate('dashboard.currentlyWorking'),
        icon: <Assignment />,
        color: '#9c27b0'
      }
    ];
  };

  const getPriorityAlerts = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const workOrders = data.work_orders || {};
    const inventory = data.inventory || {};

    const alerts = [];

                // High priority work orders
            if (parseInt(workOrders.high_priority_orders || 0) > 0) {
              alerts.push({
                type: 'warning',
                title: translate('dashboard.highPriorityWorkOrders'),
                count: parseInt(workOrders.high_priority_orders || 0),
                icon: <Warning />,
                color: '#ed6c02'
              });
            }

            // Low stock items
            if (parseInt(inventory.low_stock_items || 0) > 0) {
              alerts.push({
                type: 'info',
                title: translate('dashboard.lowStockItems'),
                count: parseInt(inventory.low_stock_items || 0),
                icon: <Inventory />,
                color: '#1976d2'
              });
            }

            // Out of stock items
            if (parseInt(inventory.out_of_stock_items || 0) > 0) {
              alerts.push({
                type: 'error',
                title: translate('dashboard.outOfStockItems'),
                count: parseInt(inventory.out_of_stock_items || 0),
                icon: <Warning />,
                color: '#d32f2f'
              });
            }

    return alerts;
  };

  const adminStats = getAdminStats();
  const performanceMetrics = getPerformanceMetrics();
  const priorityAlerts = getPriorityAlerts();

  return (
    <Box sx={{ py: 3, px: 3, width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
        {translate('dashboard.businessDashboard')}
      </Typography>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid xs={12}>
          {/* Priority Alerts */}
          {priorityAlerts.length > 0 && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                {translate('dashboard.priorityAlerts')}
              </Typography>
              <Grid container spacing={3}>
                {priorityAlerts.map((alert, index) => (
                  <Grid key={index} xs={12} sm={6} lg={4}>
                    <Paper 
                      sx={{ 
                        p: 2.5, 
                        minHeight: '120px',
                        borderLeft: `4px solid ${alert.color}`,
                        backgroundColor: `${alert.color}08`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: alert.color, width: 40, height: 40 }}>
                          {alert.icon}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {alert.title}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: alert.color }}>
                            {alert.count}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Main Stat Cards */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              {translate('dashboard.keyMetrics')}
            </Typography>
            <Grid container spacing={3}>
              {adminStats.map((stat, index) => (
                <Grid key={index} xs={12} sm={6} lg={3}>
                                     <Card 
                     sx={{ 
                       height: '200px',
                       cursor: 'pointer',
                       transition: 'all 0.3s ease-in-out',
                       display: 'flex',
                       flexDirection: 'column',
                       '&:hover': {
                         transform: 'translateY(-4px)',
                         boxShadow: 8,
                       }
                     }}
                     onClick={stat.onClick}
                   >
                     <CardContent sx={{ 
                       p: 2.5, 
                       flex: 1, 
                       display: 'flex', 
                       flexDirection: 'column',
                       height: '100%'
                     }}>
                       {/* Fixed height container for title and value to ensure alignment */}
                       <Box sx={{ height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                         <Box display="flex" alignItems="flex-start" gap={2}>
                           <Avatar sx={{ bgcolor: stat.color, width: 40, height: 40 }}>
                             {stat.icon}
                           </Avatar>
                           <Box flex={1}>
                             <Typography 
                               variant="h6" 
                               sx={{ 
                                 fontWeight: 600, 
                                 color: stat.color, 
                                 mb: 0.5,
                                 minHeight: '48px',
                                 display: 'flex',
                                 alignItems: 'flex-start'
                               }}
                             >
                               {stat.title}
                             </Typography>
                           </Box>
                           <Box display="flex" alignItems="center" gap={1}>
                             {stat.trendDirection === 'up' ? (
                               <TrendingUp sx={{ color: '#2e7d32', fontSize: 20 }} />
                             ) : (
                               <TrendingDown sx={{ color: '#d32f2f', fontSize: 20 }} />
                             )}
                             <Typography 
                               variant="caption" 
                               sx={{ 
                                 color: stat.trendDirection === 'up' ? '#2e7d32' : '#d32f2f',
                                 fontWeight: 600
                               }}
                             >
                               {stat.trend}
                             </Typography>
                           </Box>
                         </Box>
                         
                         {/* Value positioned at consistent location */}
                         <Typography 
                           variant="h5" 
                           sx={{ 
                             fontWeight: 700, 
                             color: 'text.primary',
                             mt: 1
                           }}
                         >
                           {stat.value}
                         </Typography>
                       </Box>
                       
                       <Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
                         <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 2 }}>
                           {stat.subtitle}
                         </Typography>
                         <Chip 
                           label={stat.linkText} 
                           size="small" 
                           sx={{ 
                             bgcolor: stat.color, 
                             color: 'white',
                             '&:hover': { bgcolor: stat.color, opacity: 0.8 }
                           }}
                         />
                       </Box>
                     </CardContent>
                   </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Performance Metrics */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              {translate('dashboard.performanceMetrics')}
            </Typography>
            <Grid container spacing={3}>
              {performanceMetrics.map((metric, index) => (
                <Grid key={index} xs={12} sm={6} lg={3}>
                                     <Paper 
                     sx={{ 
                       p: 2.5, 
                       height: '200px',
                       display: 'flex',
                       flexDirection: 'column',
                       cursor: 'pointer',
                       transition: 'all 0.3s ease-in-out',
                       '&:hover': {
                         transform: 'translateY(-4px)',
                         boxShadow: 8,
                       }
                     }}
                   >
                    <Box sx={{ height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <Box display="flex" alignItems="flex-start" gap={2}>
                        <Avatar sx={{ bgcolor: metric.color, width: 40, height: 40 }}>
                          {metric.icon}
                        </Avatar>
                        <Box flex={1}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 600, 
                              color: metric.color, 
                              mb: 0.5,
                              minHeight: '48px',
                              display: 'flex',
                              alignItems: 'flex-start'
                            }}
                          >
                            {metric.title}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Value positioned at consistent location */}
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontWeight: 700, 
                          color: 'text.primary',
                          mt: 1
                        }}
                      >
                        {metric.value}
                      </Typography>
                    </Box>
                    
                    <Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 2 }}>
                        {metric.subtitle}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Technician Workload */}
          <Box mb={3}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              {translate('dashboard.technicianWorkload')}
            </Typography>
            <TechnicianWorkload
              data={technicianWorkload?.data?.data || []}
              isLoading={workloadLoading}
              error={workloadError}
            />
          </Box>

          {/* Recent Activity and Insights */}
          <Grid container spacing={3}>
            {/* Recent Activity - Large Section */}
            <Grid xs={12} lg={8}>
              <Paper sx={{ p: 2.5, height: '100%' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {translate('dashboard.recentActivity')}
                  </Typography>
                  <Tooltip title={translate('dashboard.viewDetails')}>
                    <IconButton size="small">
                      <MoreVert />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                <RecentActivity 
                  activities={dashboardData?.data?.data?.recent_activity || []}
                  isLoading={dashboardLoading}
                />
              </Paper>
            </Grid>

            {/* Most Used Parts and Most Repaired Machines - Stacked on Right */}
            <Grid xs={12} lg={4}>
              <Stack spacing={3}>
                {/* Most Used Parts */}
                <Paper sx={{ p: 2.5 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    {translate('dashboard.mostUsedParts')}
                  </Typography>
                  <MostUsedParts 
                    parts={dashboardData?.data?.data?.most_used_parts || []} 
                    isLoading={dashboardLoading}
                  />
                </Paper>

                {/* Most Repaired Machines */}
                <Paper sx={{ p: 2.5 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    {translate('dashboard.mostRepairedMachines')}
                  </Typography>
                  <MostRepairedMachines 
                    machines={dashboardData?.data?.data?.most_repaired_machines || []} 
                    isLoading={dashboardLoading}
                  />
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
