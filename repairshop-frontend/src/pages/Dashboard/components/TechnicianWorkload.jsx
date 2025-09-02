import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
  IconButton
} from '@mui/material';
import {
  Person,
  Work,
  Build,
  ConfirmationNumber,
  Assignment,
  CheckCircle,
  Schedule,
  Warning,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function TechnicianWorkload({ data, isLoading, error }) {
  const { translate } = useLanguage();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {translate('dashboard.dataLoadingError')}
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert severity="info">
        {translate('dashboard.noTechniciansFound')}
      </Alert>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const getWorkloadScore = (totalOrders) => {
    if (totalOrders === 0) return { score: 0, color: 'default', label: translate('dashboard.noWork') };
    if (totalOrders <= 3) return { score: totalOrders, color: 'success', label: translate('dashboard.light') };
    if (totalOrders <= 7) return { score: totalOrders, color: 'warning', label: translate('dashboard.moderate') };
    return { score: totalOrders, color: 'error', label: translate('dashboard.heavy') };
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Person sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          {translate('dashboard.technicianWorkload')}
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2" fontWeight="bold">
                  {translate('dashboard.technician')}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.totalWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Work sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.total')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.pendingWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Schedule sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.pending')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.activeWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Assignment sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.active')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.completedWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <CheckCircle sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.completed')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.highPriorityWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Warning sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.highPriority')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.warrantyWorkOrders')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <Build sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.warranty')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.repairTickets')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <ConfirmationNumber sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.tickets')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.completionRate')}>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {translate('dashboard.completionRate')}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                <Tooltip title={translate('dashboard.workloadLevel')}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {translate('dashboard.workload')}
                  </Typography>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((technician) => {
              // Parse all values to ensure they're numbers
              const totalRegular = parseInt(technician.total_regular_orders) || 0;
              const totalWarranty = parseInt(technician.total_warranty_orders) || 0;
              const totalOrders = totalRegular + totalWarranty;
              
              const pendingRegular = parseInt(technician.pending_regular_orders) || 0;
              const pendingWarranty = parseInt(technician.pending_warranty_orders) || 0;
              const totalPending = pendingRegular + pendingWarranty;
              
              const activeRegular = parseInt(technician.active_regular_orders) || 0;
              const activeWarranty = parseInt(technician.active_warranty_orders) || 0;
              const totalActive = activeRegular + activeWarranty;
              
              const completedRegular = parseInt(technician.completed_regular_orders) || 0;
              const completedWarranty = parseInt(technician.completed_warranty_orders) || 0;
              const totalCompleted = completedRegular + completedWarranty;
              
              const highPriorityRegular = parseInt(technician.high_priority_regular_orders) || 0;
              const highPriorityWarranty = parseInt(technician.high_priority_warranty_orders) || 0;
              const totalHighPriority = highPriorityRegular + highPriorityWarranty;
              
              const totalTickets = parseInt(technician.total_repair_tickets) || 0;
              const totalWarrantyTickets = parseInt(technician.total_warranty_repair_tickets) || 0;
              const totalAllTickets = totalTickets + totalWarrantyTickets;
              
              const completionRate = parseInt(technician.completion_rate) || 0;
              
              const workload = getWorkloadScore(totalOrders);

              return (
                <TableRow key={technician.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                        {technician.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {technician.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {technician.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="bold">
                      {totalOrders}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={totalPending}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={totalActive}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={totalCompleted}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={totalHighPriority}
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {totalWarranty}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {totalWarrantyTickets} {translate('dashboard.tickets')}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="medium">
                      {totalAllTickets}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={`${completionRate}%`}
                      size="small"
                      color={completionRate >= 80 ? 'success' : completionRate >= 60 ? 'warning' : 'error'}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Tooltip title={`${workload.label} workload (${workload.score} orders)`}>
                      <Chip
                        label={workload.label}
                        size="small"
                        color={workload.color}
                        variant="filled"
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
