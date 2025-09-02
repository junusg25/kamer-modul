import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useLanguage } from '../contexts/LanguageContext'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Fade,
  Zoom,
  useTheme,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Assignment as AssignmentIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Message as MessageIcon,
  Done as DoneIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  PriorityHigh as PriorityHighIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Engineering as EngineeringIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  Menu as MenuIcon,
} from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useWebSocket } from '../contexts/WebSocketContext'

export default function Notifications() {
  const navigate = useNavigate()
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { translate, formatDate, formatDateTime } = useLanguage()
  const { isConnected, socket } = useWebSocket()
  
  // State management
  const [activeTab, setActiveTab] = React.useState(0)
  const [filterType, setFilterType] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(25)
  const [selectedNotifications, setSelectedNotifications] = React.useState([])
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false)
  const [soundEnabled, setSoundEnabled] = React.useState(true)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [refreshInterval, setRefreshInterval] = React.useState(30)

  // URL params
  const currentPage = parseInt(searchParams.get('page')) || 1
  const currentType = searchParams.get('type') || 'all'
  const currentSearch = searchParams.get('search') || ''

  // Queries
  const notifications = useQuery({
    queryKey: ['notifications', 'page', currentPage, currentType, currentSearch, rowsPerPage],
    queryFn: async () => {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
        ...(currentType !== 'all' && { type: currentType }),
        ...(currentSearch && { search: currentSearch })
      }
      return (await api.get('/notifications', { params })).data
    },
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  })

  const unreadCount = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  })

  // Mutations
  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read'),
          onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        toast.success(translate('common.allNotificationsMarkedAsRead'))
      },
  })

  const markAsRead = useMutation({
    mutationFn: (notificationId) => api.patch(`/notifications/${notificationId}/mark-read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const deleteNotification = useMutation({
    mutationFn: (notificationId) => api.delete(`/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(translate('common.notificationDeleted'))
    },
  })

  const deleteMultipleNotifications = useMutation({
    mutationFn: (notificationIds) => api.post('/notifications/delete-multiple', { ids: notificationIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setSelectedNotifications([])
      toast.success(translate('common.notificationsDeleted', { count: selectedNotifications.length }))
    },
  })

  // Handlers
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
    setPage(0)
    setSearchParams({ page: 1, type: filterType, search: searchQuery })
  }

  const handleFilterChange = (event) => {
    const newType = event.target.value
    setFilterType(newType)
    setPage(0)
    setSearchParams({ page: 1, type: newType, search: searchQuery })
  }

  const handleSearchChange = (event) => {
    const newSearch = event.target.value
    setSearchQuery(newSearch)
    setPage(0)
    setSearchParams({ page: 1, type: filterType, search: newSearch })
  }

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
    setSearchParams({ page: newPage + 1, type: filterType, search: searchQuery })
  }

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10)
    setRowsPerPage(newRowsPerPage)
    setPage(0)
    setSearchParams({ page: 1, type: filterType, search: searchQuery })
  }

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id)
    }

    if (notification.related_entity_type && notification.related_entity_id) {
      switch (notification.related_entity_type) {
        case 'work_order':
          navigate(`/work-orders/${notification.related_entity_id}`)
          break
        case 'warranty_work_order':
          navigate(`/warranty-work-orders/${notification.related_entity_id}`)
          break
        case 'repair_ticket':
          navigate(`/repair-tickets/${notification.related_entity_id}`)
          break
        case 'customer':
          navigate(`/customers/${notification.related_entity_id}`)
          break
        case 'machine':
                          navigate(`/machines/detail/${notification.related_entity_id}`)
          break
        case 'inventory':
          navigate(`/inventory/${notification.related_entity_id}`)
          break
        default:
          break
      }
    }
  }

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  const handleDeleteNotification = (notificationId) => {
    deleteNotification.mutate(notificationId)
  }

  const handleDeleteSelected = () => {
    if (selectedNotifications.length > 0) {
      deleteMultipleNotifications.mutate(selectedNotifications)
    }
  }

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    )
  }

  const handleSelectAll = () => {
    if (selectedNotifications.length === notifications.data?.notifications?.length) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(notifications.data?.notifications?.map(n => n.id) || [])
    }
  }

  // WebSocket real-time notification handling
  React.useEffect(() => {
    if (!socket) return;

    const handleNotificationReceived = (data) => {
      try {
        console.log('Real-time notification received on notifications page:', data);
        
        // Show toast notification
        toast.success(data.notification.title_key || 'New notification received', {
          duration: 4000,
          position: 'top-right'
        });
        
        // Invalidate queries to refresh notification data
        queryClient.invalidateQueries({ queryKey: ['notifications'] });

        // Play notification sound if available
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.play().catch(error => {
            console.log('Could not play notification sound:', error.message);
          });
        } catch (error) {
          console.log('Notification sound not available');
        }
      } catch (error) {
        console.error('Error handling notification received:', error);
      }
    };

    const handleNotificationCountUpdate = (data) => {
      try {
        console.log('Notification count updated on notifications page:', data);
        // Invalidate unread count query
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      } catch (error) {
        console.error('Error handling notification count update:', error);
      }
    };

    // Add event listeners with error handling
    try {
      socket.on('notification_received', handleNotificationReceived);
      socket.on('notification_count_updated', handleNotificationCountUpdate);
    } catch (error) {
      console.error('Error setting up WebSocket event listeners:', error);
    }
    
    return () => {
      try {
        socket.off('notification_received', handleNotificationReceived);
        socket.off('notification_count_updated', handleNotificationCountUpdate);
      } catch (error) {
        console.error('Error cleaning up WebSocket event listeners:', error);
      }
    };
  }, [socket, queryClient]);

  // Utility functions
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon color="success" fontSize="small" />
      case 'warning':
        return <WarningIcon color="warning" fontSize="small" />
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />
      case 'work_order':
        return <AssignmentIcon color="primary" fontSize="small" />
      case 'warranty_work_order':
        return <SecurityIcon color="success" fontSize="small" />
      case 'repair_ticket':
        return <ReceiptIcon color="secondary" fontSize="small" />
      case 'inventory':
        return <InventoryIcon color="secondary" fontSize="small" />
      case 'communication':
        return <MessageIcon color="info" fontSize="small" />
      case 'customer':
        return <PersonIcon color="primary" fontSize="small" />
      case 'machine':
        return <BuildIcon color="primary" fontSize="small" />
      case 'system':
        return <EngineeringIcon color="action" fontSize="small" />
      default:
        return <InfoIcon color="action" fontSize="small" />
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
        return 'success'
      case 'warning':
        return 'warning'
      case 'error':
        return 'error'
      case 'work_order':
        return 'primary'
      case 'warranty_work_order':
        return 'success'
      case 'repair_ticket':
        return 'secondary'
      case 'inventory':
        return 'secondary'
      case 'communication':
        return 'info'
      case 'customer':
        return 'primary'
      case 'machine':
        return 'primary'
      case 'system':
        return 'primary'
      default:
        return 'primary'
    }
  }

  const formatTimeAgo = (dateString) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return translate('common.justNow')
    if (diffInSeconds < 3600) return translate('common.minutesAgo', { minutes: Math.floor(diffInSeconds / 60) })
    if (diffInSeconds < 86400) return translate('common.hoursAgo', { hours: Math.floor(diffInSeconds / 3600) })
    if (diffInSeconds < 2592000) return translate('common.daysAgo', { days: Math.floor(diffInSeconds / 86400) })
    return format(new Date(dateString), 'dd.MM.yyyy')
  }

    const translateNotificationContent = (notification) => {
    // If the notification has translation keys, use them
    if (notification.title_key && notification.message_key) {
      try {
        // message_params is already a JSON object from the database
        const messageParams = notification.message_params || {}

        // Handle pluralization for work orders
        if (messageParams.count !== undefined) {
          messageParams.plural = messageParams.count > 1 ? 's' : ''
        }

        // Auto-translate status parameters if they are translation keys
        const translatedParams = { ...messageParams }
        Object.keys(translatedParams).forEach(key => {
          const value = translatedParams[key]
          if (typeof value === 'string' && value.startsWith('status.')) {
            // This is a status translation key, translate it
            translatedParams[key] = translate(value)
          }
        })

        const translatedTitle = translate(notification.title_key, translatedParams)
        const translatedMessage = translate(notification.message_key, translatedParams)

        return { title: translatedTitle, message: translatedMessage }
      } catch (error) {
        console.error('Error translating notification:', error)
        // Fallback to original title/message
        return { title: notification.title, message: notification.message }
      }
    }

    // Fallback to original title/message for legacy notifications
    return { title: notification.title, message: notification.message }
  }

  const exportNotifications = () => {
    const data = notifications.data?.notifications || []
    const csvContent = [
      [translate('tableHeaders.id'), translate('tableHeaders.title'), translate('tableHeaders.message'), translate('tableHeaders.type'), translate('tableHeaders.read'), translate('tableHeaders.createdAt')],
      ...data.map(n => {
        const translatedContent = translateNotificationContent(n)
        return [
          n.id,
          translatedContent.title,
          translatedContent.message,
          n.type,
          n.is_read ? translate('common.yes') : translate('common.no'),
          formatDateTime(n.created_at)
        ]
      })
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${translate('common.notifications')}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // DataGrid columns
  const columns = [
    {
      field: 'select',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params) => (
        <input
          type="checkbox"
          checked={selectedNotifications.includes(params.row.id)}
          onChange={() => handleSelectNotification(params.row.id)}
          style={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      field: 'icon',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params) => getNotificationIcon(params.row.type),
    },
    {
      field: 'title',
      headerName: translate('tableHeaders.title'),
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: params.row.is_read ? 400 : 600,
              color: params.row.is_read ? 'text.secondary' : 'text.primary',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              flex: 1,
              minWidth: 0
            }}
          >
            {translateNotificationContent(params.row).title}
          </Typography>
          {!params.row.is_read && (
            <Chip
              label={translate('common.new')}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
            />
          )}
        </Box>
      ),
    },
    {
      field: 'message',
      headerName: translate('tableHeaders.message'),
      width: 300,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          sx={{ 
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%',
            lineHeight: 1.4
          }}
        >
          {translateNotificationContent(params.row).message}
        </Typography>
      ),
    },
    {
      field: 'type',
      headerName: translate('tableHeaders.type'),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.type.replace('_', ' ')}
          color={getNotificationColor(params.row.type)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'is_read',
      headerName: translate('tableHeaders.status'),
      width: 100,
      renderCell: (params) => (
        <Chip
                      label={params.row.is_read ? translate('tableHeaders.read') : translate('common.unread')}
          color={params.row.is_read ? 'default' : 'primary'}
          size="small"
          variant={params.row.is_read ? 'outlined' : 'filled'}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: translate('tableHeaders.time'),
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {formatTimeAgo(params.row.created_at)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: translate('tableHeaders.actions'),
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={translate('common.markAsRead')}>
            <IconButton
              size="small"
              onClick={() => markAsRead.mutate(params.row.id)}
              disabled={params.row.is_read}
            >
              <DoneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={translate('common.delete')}>
            <IconButton
              size="small"
              onClick={() => handleDeleteNotification(params.row.id)}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  if (notifications.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (notifications.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {translate('common.failedToLoadNotifications')}: {notifications.error.message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {translate('common.notifications')}
          </Typography>
          <Chip
            icon={<NotificationsIcon />}
            label={`${unreadCount.data?.unreadCount || 0} ${translate('common.unread')}`}
            color="primary"
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={translate('common.settings')}>
            <IconButton onClick={() => setSettingsDialogOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={translate('common.export')}>
            <IconButton onClick={exportNotifications}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={translate('common.refresh')}>
            <IconButton 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
              disabled={notifications.isLoading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item columns={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <NotificationsIcon color="primary" />
                <Box>
                  <Typography variant="h6">{notifications.data?.pagination?.total || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">{translate('common.total')}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item columns={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ErrorIcon color="error" />
                <Box>
                  <Typography variant="h6">
                    {notifications.data?.notifications?.filter(n => n.type === 'error').length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{translate('common.errors')}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item columns={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="h6">
                    {notifications.data?.notifications?.filter(n => n.type === 'warning').length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{translate('common.warnings')}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item columns={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AssignmentIcon color="primary" />
                <Box>
                  <Typography variant="h6">
                    {notifications.data?.notifications?.filter(n => n.type === 'work_order').length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{translate('common.workOrders')}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item columns={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                placeholder={translate('common.searchNotifications')}
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon />
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item columns={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>{translate('tableHeaders.type')}</InputLabel>
                <Select
                  value={filterType}
                  label={translate('tableHeaders.type')}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">{translate('common.allTypes')}</MenuItem>
                  <MenuItem value="work_order">{translate('common.workOrders')}</MenuItem>
                  <MenuItem value="warranty_work_order">{translate('common.warrantyWorkOrders')}</MenuItem>
                  <MenuItem value="repair_ticket">{translate('common.repairTickets')}</MenuItem>
                  <MenuItem value="inventory">{translate('common.inventory')}</MenuItem>
                  <MenuItem value="customer">{translate('common.customers')}</MenuItem>
                  <MenuItem value="machine">{translate('common.machines')}</MenuItem>
                  <MenuItem value="communication">{translate('common.communication')}</MenuItem>
                  <MenuItem value="success">{translate('common.success')}</MenuItem>
                  <MenuItem value="warning">{translate('common.warning')}</MenuItem>
                  <MenuItem value="error">{translate('common.error')}</MenuItem>
                  <MenuItem value="info">{translate('common.info')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item columns={{ xs: 12, md: 3 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleMarkAllRead}
                  disabled={markAllRead.isLoading || (unreadCount.data?.unreadCount || 0) === 0}
                  startIcon={markAllRead.isLoading ? <CircularProgress size={16} /> : <DoneIcon />}
                >
                  {translate('common.markAllRead')}
                </Button>
                {selectedNotifications.length > 0 && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleDeleteSelected}
                    disabled={deleteMultipleNotifications.isLoading}
                    startIcon={<DeleteIcon />}
                  >
                    {translate('common.deleteSelected')} ({selectedNotifications.length})
                  </Button>
                )}
              </Box>
            </Grid>
            <Grid item columns={{ xs: 12, md: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleSelectAll}
                  size="small"
                >
                  {selectedNotifications.length === notifications.data?.notifications?.length ? translate('common.deselectAll') : translate('common.selectAll')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label={`${translate('common.all')} (${notifications.data?.notifications?.length || 0})`} />
          <Tab label={`${translate('common.unread')} (${unreadCount.data?.unreadCount || 0})`} />
        </Tabs>
      </Box>

      {/* DataGrid */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <DataGrid
            rows={notifications.data?.notifications || []}
            columns={columns}
            pageSize={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onPageSizeChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
            disableSelectionOnClick
            onRowClick={(params) => handleNotificationClick(params.row)}
            autoHeight
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Pagination Info */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {translate('common.showing', { start: ((currentPage - 1) * rowsPerPage) + 1, end: Math.min(currentPage * rowsPerPage, notifications.data?.pagination?.total || 0), total: notifications.data?.pagination?.total || 0, item: translate('common.notifications') })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {translate('common.page', { current: currentPage, total: notifications.data?.pagination?.totalPages || 1 })}
        </Typography>
      </Box>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{translate('common.notificationSettings')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              }
              label={translate('common.enableSoundNotifications')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label={translate('common.autoRefreshNotifications')}
            />
            <FormControl fullWidth>
              <InputLabel>{translate('common.refreshInterval')}</InputLabel>
              <Select
                value={refreshInterval}
                label={translate('common.refreshInterval')}
                onChange={(e) => setRefreshInterval(e.target.value)}
                disabled={!autoRefresh}
              >
                <MenuItem value={15}>{translate('common.fifteenSeconds')}</MenuItem>
                <MenuItem value={30}>{translate('common.thirtySeconds')}</MenuItem>
                <MenuItem value={60}>{translate('common.oneMinute')}</MenuItem>
                <MenuItem value={300}>{translate('common.fiveMinutes')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>{translate('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
