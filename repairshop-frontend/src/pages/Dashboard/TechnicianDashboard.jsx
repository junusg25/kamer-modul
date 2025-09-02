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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment,
  PlayArrow,
  CheckCircle,
  Work,
  TrendingUp,
  TrendingDown,
  MoreVert,
  Schedule,
  Speed,
  Person,
  Warning,
  Star,
  Timer,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard, MostUsedParts, MostRepairedMachines, RecentActivity } from './components';
import {
  useDashboardData
} from './hooks/useDashboardData';

export default function TechnicianDashboard() {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State for collapsible sections
  const [workMetricsExpanded, setWorkMetricsExpanded] = React.useState(true);
  const [warrantyMetricsExpanded, setWarrantyMetricsExpanded] = React.useState(true);

  // Data fetching
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData();




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
  if (dashboardLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Extract technician stats from dashboard data
  const getTechnicianStats = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const userSpecific = data.user_specific || {};
    
    const totalOrders = parseInt(userSpecific.my_pending_orders || 0) + parseInt(userSpecific.my_active_orders || 0) + parseInt(userSpecific.my_completed_orders || 0);
    const completionRate = totalOrders > 0 ? Math.round((parseInt(userSpecific.my_completed_orders || 0) / totalOrders) * 100) : 0;
    
    return [
      {
        title: translate('dashboard.myPendingWork'),
        value: parseInt(userSpecific.my_pending_orders || 0).toString(),
        subtitle: `${parseInt(userSpecific.my_high_priority_orders || 0)} ${translate('dashboard.highPriority')}`,
        icon: <Assignment />,
        color: '#ed6c02',
        trend: '+3',
        trendDirection: 'up',
        onClick: () => navigate(`/non-warranty?tab=work-orders&status=pending&technician=${user?.id}`),
        linkText: translate('dashboard.viewMyPendingWork')
      },
      {
        title: translate('dashboard.activeWorkOrders'),
        value: parseInt(userSpecific.my_active_orders || 0).toString(),
        subtitle: `${parseInt(userSpecific.my_active_orders || 0)} ${translate('dashboard.inProgress')}`,
        icon: <PlayArrow />,
        color: '#1976d2',
        trend: '+1',
        trendDirection: 'up',
        onClick: () => navigate(`/non-warranty?tab=work-orders&status=in_progress&technician=${user?.id}`),
        linkText: translate('dashboard.viewMyActiveOrders')
      },
      {
        title: translate('dashboard.highPriorityWork'),
        value: parseInt(userSpecific.my_high_priority_orders || 0).toString(),
        subtitle: `${translate('dashboard.requiresAttention')}`,
        icon: <Warning />,
        color: '#d32f2f',
        trend: '+2',
        trendDirection: 'up',
        onClick: () => navigate(`/non-warranty?tab=work-orders&priority=high&technician=${user?.id}`),
        linkText: translate('dashboard.viewHighPriorityWork')
      },
      {
        title: translate('dashboard.completionRate'),
        value: `${completionRate}%`,
        subtitle: translate('dashboard.workOrderCompletion'),
        icon: <CheckCircle />,
        color: '#ed6c02',
        trend: '+5%',
        trendDirection: 'up',
        onClick: () => navigate(`/non-warranty?tab=work-orders&status=completed&technician=${user?.id}`),
        linkText: translate('dashboard.viewCompletedOrders')
      }
    ];
  };

  const getWarrantyStats = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const userSpecific = data.user_specific || {};
    
    const totalWarrantyOrders = parseInt(userSpecific.my_warranty_pending || 0) + parseInt(userSpecific.my_warranty_active || 0) + parseInt(userSpecific.my_warranty_completed || 0);
    const warrantyCompletionRate = totalWarrantyOrders > 0 ? Math.round((parseInt(userSpecific.my_warranty_completed || 0) / totalWarrantyOrders) * 100) : 0;
    
    return [
      {
        title: translate('dashboard.myPendingWarrantyWork'),
        value: parseInt(userSpecific.my_warranty_pending || 0).toString(),
        subtitle: `${parseInt(userSpecific.my_warranty_high_priority || 0)} ${translate('dashboard.highPriority')}`,
        icon: <Assignment />,
        color: '#ed6c02',
        trend: '+2',
        trendDirection: 'up',
        onClick: () => navigate(`/warranty?tab=warranty-work-orders&status=pending&technician=${user?.id}`),
        linkText: translate('dashboard.viewMyPendingWarrantyWork')
      },
      {
        title: translate('dashboard.activeWarrantyWork'),
        value: parseInt(userSpecific.my_warranty_active || 0).toString(),
        subtitle: `${parseInt(userSpecific.my_warranty_active || 0)} ${translate('dashboard.inProgress')}`,
        icon: <PlayArrow />,
        color: '#1976d2',
        trend: '+1',
        trendDirection: 'up',
        onClick: () => navigate(`/warranty?tab=warranty-work-orders&status=in_progress&technician=${user?.id}`),
        linkText: translate('dashboard.viewMyActiveWarrantyWork')
      },
      {
        title: translate('dashboard.highPriorityWarrantyWork'),
        value: parseInt(userSpecific.my_warranty_high_priority || 0).toString(),
        subtitle: `${translate('dashboard.requiresAttention')}`,
        icon: <Warning />,
        color: '#d32f2f',
        trend: '+1',
        trendDirection: 'up',
        onClick: () => navigate(`/warranty?tab=warranty-work-orders&priority=high&technician=${user?.id}`),
        linkText: translate('dashboard.viewHighPriorityWarrantyWork')
      },
      {
        title: translate('dashboard.warrantyCompletionRate'),
        value: `${warrantyCompletionRate}%`,
        subtitle: translate('dashboard.warrantyWorkOrderCompletion'),
        icon: <CheckCircle />,
        color: '#ed6c02',
        trend: '+4%',
        trendDirection: 'up',
        onClick: () => navigate(`/warranty?tab=warranty-work-orders&status=completed&technician=${user?.id}`),
        linkText: translate('dashboard.viewCompletedWarrantyOrders')
      }
    ];
  };

  const getPerformanceMetrics = () => {
    if (!dashboardData?.data?.data) return [];

    const data = dashboardData.data.data;
    const userSpecific = data.user_specific || {};
    const performance = data.performance || {};
    const workOrders = data.work_orders || {};

    const totalOrders = parseInt(userSpecific.my_pending_orders || 0) + parseInt(userSpecific.my_active_orders || 0) + parseInt(userSpecific.my_completed_orders || 0);
    const completionRate = totalOrders > 0 ? Math.round((parseInt(userSpecific.my_completed_orders || 0) / totalOrders) * 100) : 0;
    const avgCompletionHours = parseFloat(userSpecific.my_avg_completion_hours || 0);
    const totalRevenue = parseFloat(userSpecific.my_total_revenue || 0);
    
    // Calculate workload share
    const totalSystemOrders = parseInt(workOrders.pending_orders || 0) + parseInt(workOrders.active_orders || 0) + parseInt(workOrders.completed_orders || 0);
    const myShare = totalSystemOrders > 0 ? Math.round((totalOrders / totalSystemOrders) * 100) : 0;

    return [
      {
        title: translate('dashboard.totalRevenue'),
        value: `$${totalRevenue.toLocaleString()}`,
        subtitle: translate('dashboard.fromCompletedWorkOrders'),
        icon: <TrendingUp />,
        color: '#2e7d32'
      },
      {
        title: translate('dashboard.efficiency'),
        value: `${Math.min(Math.round((completionRate * 0.6) + (Math.max(0, 100 - (avgCompletionHours * 10)) * 0.4)), 100)}%`,
        subtitle: translate('dashboard.efficiencyScore'),
        icon: <Star />,
        color: '#9c27b0'
      },
      {
        title: translate('dashboard.workloadShare'),
        value: `${myShare}%`,
        subtitle: translate('dashboard.ofTotalSystemWorkload'),
        icon: <Assignment />,
        color: '#1976d2'
      },
      {
        title: translate('dashboard.estimatedTime'),
        value: `${Math.round(avgCompletionHours * totalOrders)}h`,
        subtitle: translate('dashboard.toCompleteAllWork'),
        icon: <Timer />,
        color: '#9c27b0'
      }
    ];
  };



  const technicianStats = getTechnicianStats();
  const warrantyStats = getWarrantyStats();
  const performanceMetrics = getPerformanceMetrics();
  
  // Get user-specific data for achievements
  const userSpecific = dashboardData?.data?.data?.user_specific || {};

  return (
    <Box sx={{ mt: 4, mb: 4, px: 3, width: '100%' }}>
                    {/* Header Section */}
              <Box mb={3}>
                <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {translate('dashboard.myDashboard')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {translate('dashboard.workOverview')}
                </Typography>
                <Divider />
              </Box>

                    {/* Welcome Card */}
              <Box mb={3}>
                <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {translate('dashboard.welcomeBack')}, {user?.name}!
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        {translate('dashboard.todayWorkSummary')}
                      </Typography>
                    </Box>
                                <Avatar sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.2)' }}>
                      <Person sx={{ fontSize: 24 }} />
                    </Avatar>
          </Box>
        </Paper>
      </Box>

                    {/* Main Stat Cards */}
              <Box mb={3}>
                <Box 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="space-between" 
                  sx={{ mb: 2, cursor: 'pointer' }}
                  onClick={() => setWorkMetricsExpanded(!workMetricsExpanded)}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {translate('dashboard.myWorkMetrics')}
                  </Typography>
                  {workMetricsExpanded ? <ExpandLess /> : <ExpandMore />}
                </Box>
                {workMetricsExpanded && (
        <Grid container spacing={3}>
          {technicianStats.map((stat, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card 
                sx={{ 
                  minHeight: '180px', // Ensure consistent height for all cards
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
                   flexDirection: 'column'
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
                             minHeight: '48px', // Ensure consistent height for titles
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
                   
                                       <Box mt={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                )}
       </Box>

                     {/* My Work Metrics - Warranty */}
       <Box mb={3}>
         <Box 
           display="flex" 
           alignItems="center" 
           justifyContent="space-between" 
           sx={{ mb: 2, cursor: 'pointer' }}
           onClick={() => setWarrantyMetricsExpanded(!warrantyMetricsExpanded)}
         >
           <Typography variant="h6" sx={{ fontWeight: 600 }}>
             {translate('dashboard.myWorkMetricsWarranty')}
           </Typography>
           {warrantyMetricsExpanded ? <ExpandLess /> : <ExpandMore />}
         </Box>
         {warrantyMetricsExpanded && (
         <Grid container spacing={3}>
           {warrantyStats.map((stat, index) => (
             <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
               <Card 
                 sx={{ 
                   minHeight: '180px', // Ensure consistent height for all cards
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
                   flexDirection: 'column'
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
                             minHeight: '48px', // Ensure consistent height for titles
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
                   
                   <Box mt={3}>
                     <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
        )}
       </Box>

                     {/* Performance Metrics */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  {translate('dashboard.performanceMetrics')}
                </Typography>
                 <Grid container spacing={3}>
           {performanceMetrics.map((metric, index) => (
             <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
               <Paper sx={{ 
                 p: 2.5, 
                 minHeight: '160px', // Ensure consistent height for all cards
                 display: 'flex',
                 flexDirection: 'column'
               }}>
                 {/* Fixed height container for title and value to ensure alignment */}
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
                           minHeight: '48px', // Ensure consistent height for titles
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
    </Box>
  );
}
