import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Assignment,
  Build,
  ConfirmationNumber,
  Person,
  Computer,
  Notifications,
  History
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../contexts/LanguageContext';

// Custom function to format time ago with translations
const formatTimeAgo = (date, translate) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) {
    return translate('dashboard.justNow');
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `prije ${diffInMinutes} ${diffInMinutes === 1 ? translate('dashboard.minute') : translate('dashboard.minutes')}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `prije ${diffInHours} ${diffInHours === 1 ? translate('dashboard.hour') : translate('dashboard.hours')}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `prije ${diffInDays} ${diffInDays === 1 ? translate('dashboard.day') : translate('dashboard.days')}`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `prije ${diffInWeeks} ${diffInWeeks === 1 ? translate('dashboard.week') : translate('dashboard.weeks')}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `prije ${diffInMonths} ${diffInMonths === 1 ? translate('dashboard.month') : translate('dashboard.months')}`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `prije ${diffInYears} ${diffInYears === 1 ? translate('dashboard.year') : translate('dashboard.years')}`;
};

// Function to translate activity action text
const translateActivityAction = (actionText, translate) => {
  const actionMap = {
    'new machine added': translate('dashboard.newMachineAdded'),
    'new customer added': translate('dashboard.newCustomerAdded'),
    'work order created': translate('dashboard.workOrderCreated'),
    'work order updated': translate('dashboard.workOrderUpdated'),
    'work order completed': translate('dashboard.workOrderCompleted'),
    'warranty work order created': translate('dashboard.warrantyWorkOrderCreated'),
    'warranty work order updated': translate('dashboard.warrantyWorkOrderUpdated'),
    'warranty work order completed': translate('dashboard.warrantyWorkOrderCompleted'),
    'repair ticket created': translate('dashboard.repairTicketCreated'),
    'repair ticket updated': translate('dashboard.repairTicketUpdated'),
    'repair ticket converted': translate('dashboard.repairTicketConverted'),
    'warranty repair ticket created': translate('dashboard.warrantyRepairTicketCreated'),
    'warranty repair ticket updated': translate('dashboard.warrantyRepairTicketUpdated'),
    'warranty repair ticket converted': translate('dashboard.warrantyRepairTicketConverted'),
    'customer added': translate('dashboard.customerAdded'),
    'customer updated': translate('dashboard.customerUpdated'),
    'machine added': translate('dashboard.machineAdded'),
    'machine updated': translate('dashboard.machineUpdated'),
    'inventory item created': translate('dashboard.inventoryItemCreated'),
    'inventory item updated': translate('dashboard.inventoryItemUpdated'),
    'inventory item added': translate('dashboard.inventoryItemAdded'),
  };
  
  return actionMap[actionText.toLowerCase()] || actionText;
};

export default function RecentActivity({ activities, isLoading }) {
  const navigate = useNavigate();
  const { translate } = useLanguage();

  const getActivityIcon = (type) => {
    switch (type) {
      case 'work_order_created':
      case 'work_order_updated': return <Assignment color="primary" />
      case 'warranty_work_order_created':
      case 'warranty_work_order_updated': return <Build color="success" />
      case 'repair_ticket_created':
      case 'repair_ticket_updated': return <ConfirmationNumber color="warning" />
      case 'warranty_repair_ticket_created':
      case 'warranty_repair_ticket_updated': return <ConfirmationNumber color="error" />
      case 'customer_created':
      case 'customer_updated': return <Person color="info" />
      case 'machine_created':
      case 'machine_updated': return <Computer color="secondary" />
      case 'inventory_created':
      case 'inventory_updated': return <Notifications color="action" />
      default: return <Notifications color="action" />
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'info'
      case 'pending': return 'warning'
      case 'cancelled': return 'error'
      case 'converted': return 'success'
      case 'intake': return 'warning'
      case 'active': return 'info'
      default: return 'default'
    }
  };

  const handleActivityClick = (activity) => {
    // Navigate to detail pages for specific items
    switch (activity.type) {
      case 'work_order_created':
      case 'work_order_updated':
        // Navigate to work order detail page
        navigate(`/work-orders/${activity.id}`);
        break;
        
      case 'warranty_work_order_created':
      case 'warranty_work_order_updated':
        // Navigate to warranty work order detail page
        navigate(`/warranty-work-orders/${activity.id}`);
        break;
        
      case 'repair_ticket_created':
      case 'repair_ticket_updated':
        // Navigate to repair ticket detail page
        navigate(`/repair-tickets/${activity.id}`);
        break;
        
      case 'warranty_repair_ticket_created':
      case 'warranty_repair_ticket_updated':
        // Navigate to warranty repair ticket detail page
        navigate(`/warranty-repair-tickets/${activity.id}`);
        break;
        
      case 'customer_created':
      case 'customer_updated':
        // Navigate to customer detail page
        navigate(`/customers/${activity.id}`);
        break;
        
      case 'machine_created':
      case 'machine_updated':
        // Navigate to machine detail page
        navigate(`/machines/detail/${activity.id}`);
        break;
        
      case 'inventory_created':
      case 'inventory_updated':
        // Navigate to inventory detail page
        navigate(`/inventory/${activity.id}`);
        break;
        
      default:
        // Fallback to dashboard if activity type is not recognized
        navigate('/dashboard');
        break;
    }
  };

  // Function to format activity description with more specific information
  const formatActivityDescription = (activity) => {
    const getFormattedNumber = (activity) => {
      if (activity.formatted_number) {
        return activity.formatted_number;
      }
      // Fallback to ID if no formatted number
      return `#${activity.id}`;
    };

    switch (activity.type) {
      case 'work_order_created':
      case 'work_order_updated':
        return `${translate('common.workOrder')} ${getFormattedNumber(activity)} - ${activity.description}`;
        
      case 'warranty_work_order_created':
      case 'warranty_work_order_updated':
        return `${translate('common.warrantyWorkOrder')} ${getFormattedNumber(activity)} - ${activity.description}`;
        
      case 'repair_ticket_created':
      case 'repair_ticket_updated':
        return `${translate('common.repairTicket')} ${getFormattedNumber(activity)} - ${activity.description}`;
        
      case 'warranty_repair_ticket_created':
      case 'warranty_repair_ticket_updated':
        return `${translate('common.warrantyRepairTicket')} ${getFormattedNumber(activity)} - ${activity.description}`;
        
      case 'customer_created':
      case 'customer_updated':
        return `${translate('common.customer')}: ${activity.description}`;
        
      case 'machine_created':
      case 'machine_updated':
        return `${translate('common.machine')}: ${activity.description}`;
        
      case 'inventory_created':
      case 'inventory_updated':
        return `${translate('common.inventoryItem')}: ${activity.description}`;
        
      default:
        return activity.description;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>{translate('dashboard.loadingRecentActivity')}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {translate('dashboard.noRecentActivity')}
          </Typography>
        ) : (
                  <Box>
          {activities.length > 5 && (
            <Box 
              sx={{ 
                textAlign: 'center', 
                py: 1, 
                color: 'text.secondary',
                fontSize: '0.75rem',
                borderBottom: '1px solid',
                borderColor: 'divider',
                mb: 1
              }}
            >
              {translate('dashboard.scrollForMore')} ({activities.length - 5} {translate('dashboard.moreActivities')})
            </Box>
          )}
          <List sx={{ 
            p: 0, 
            maxHeight: '400px', 
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#c1c1c1',
              borderRadius: '3px',
              '&:hover': {
                background: '#a8a8a8',
              },
            },
          }}>
            {activities.map((activity, index) => (
              <ListItem
                key={index}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'action.hover' },
                  borderRadius: 1,
                  mb: 1
                }}
                onClick={() => handleActivityClick(activity)}
              >
                <ListItemIcon>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    {getActivityIcon(activity.type)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="flex-start" gap={1} flexWrap="wrap">
                      <Typography 
                        variant="body2" 
                        fontWeight="medium"
                        sx={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        {translateActivityAction(activity.action_text, translate)}
                      </Typography>
                      {activity.status && (
                        <Chip
                          label={translate(`status.${activity.status}`)}
                          size="small"
                          color={getStatusColor(activity.status)}
                          variant="outlined"
                          sx={{ flexShrink: 0 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        component="div"
                        sx={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          lineHeight: 1.4
                        }}
                      >
                        {formatActivityDescription(activity)}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        component="div"
                        sx={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}
                      >
                        {formatTimeAgo(activity.created_at, translate)}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
        )}
      </CardContent>
    </Card>
  );
}
