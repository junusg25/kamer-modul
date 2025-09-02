import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useLanguage } from '../contexts/LanguageContext'
import { useWebSocket } from '../contexts/WebSocketContext'
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  CircularProgress,
  Chip,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Fade,
  Zoom,
  useTheme,
  TextField,
} from '@mui/material'
import {
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
  Settings as SettingsIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  PriorityHigh as PriorityHighIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Engineering as EngineeringIcon,
  Person as PersonIcon,
  Build as BuildIcon,
} from '@mui/icons-material'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function NotificationBell() {
  const navigate = useNavigate()
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { translate, formatDateTime } = useLanguage()
  const { isConnected, socket } = useWebSocket()
  const [anchorEl, setAnchorEl] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState(0)
  const [soundEnabled, setSoundEnabled] = React.useState(true)
  const [filterType, setFilterType] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [lastUnreadCount, setLastUnreadCount] = React.useState(0)
  const open = Boolean(anchorEl)

  // Sound effect for new notifications
  const playNotificationSound = React.useCallback(() => {
    if (soundEnabled) {
      try {
        const audio = new Audio('/notification-sound.mp3')
        audio.volume = 0.3
        audio.play().catch(() => {
          // Fallback: create a simple beep sound
          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
          
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.2)
        })
      } catch (error) {
        console.log('Sound not supported')
      }
    }
  }, [soundEnabled])

  // WebSocket real-time notification handling with comprehensive error handling
  React.useEffect(() => {
    if (!socket) return;

    const handleNotificationReceived = (data) => {
      try {
        console.log('Real-time notification received:', data);
        
        // Play notification sound if available
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.play().catch(error => {
            console.log('Could not play notification sound:', error.message);
          });
        } catch (error) {
          console.log('Notification sound not available');
        }
        
        // Show toast notification with translation
        const title = data.notification.title_key ? 
          translate(data.notification.title_key, data.notification.message_params || {}) : 
          translate('notifications.newNotificationReceived');
        
        // Prevent duplicate toasts by checking content and timing
        const now = Date.now();
        const contentHash = btoa(title || 'empty').substring(0, 10); // Create a short hash of the content
        const lastToastKey = `lastToast_${contentHash}`;
        const lastToastTime = localStorage.getItem(lastToastKey);
        
        // Only show toast if no identical toast was shown in the last 3 seconds
        if (lastToastTime && (now - parseInt(lastToastTime)) < 3000) {
          return;
        }
        
        // Only show toast if the translated title is valid and different from the key
        if (title && title !== data.notification.title_key && title.trim() !== '' && !title.startsWith('notifications.')) {
          toast.success(title, {
            duration: 4000,
            position: 'top-right'
          });
          
          // Store the timestamp to prevent duplicates
          localStorage.setItem(lastToastKey, now.toString());
        }
        
        // Invalidate queries to refresh notification data
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (error) {
        console.error('Error handling notification received:', error);
      }
    };

    const handleNotificationCountUpdate = (data) => {
      try {
        console.log('Notification count updated:', data);
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
  }, [socket, playNotificationSound, queryClient]);

  const unreadCount = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    refetchInterval: 30000, // Refetch every 30 seconds for faster updates
    onSuccess: (data) => {
      // Play sound if unread count increased
      if (data.unreadCount > lastUnreadCount && lastUnreadCount > 0) {
        playNotificationSound()
      }
      setLastUnreadCount(data.unreadCount)
    },
  })

  const notifications = useQuery({
    queryKey: ['notifications', 'list', filterType, searchQuery],
    queryFn: async () => {
      const params = { 
        limit: 50,
        ...(filterType !== 'all' && { type: filterType }),
        ...(searchQuery && { search: searchQuery })
      }
      return (await api.get('/notifications', { params })).data
    },
    enabled: open,
    refetchInterval: open ? 15000 : false, // Refetch every 15 seconds when open
  })

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(translate('notifications.markAllRead'))
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
      toast.success(translate('notifications.notificationDeleted'))
    },
  })

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setActiveTab(0)
    setFilterType('all')
    setSearchQuery('')
  }

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  const handleNotificationClick = (notification) => {
    // Mark as read when clicked
    if (!notification.is_read) {
      markAsRead.mutate(notification.id)
    }

    // Close the menu first
    handleClose()

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'work_order':
        if (notification.related_entity_id) {
          navigate(`/work-orders/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for work order notification:', notification)
          navigate('/work-orders')
        }
        break
      case 'warranty_work_order':
        if (notification.related_entity_id) {
          navigate(`/warranty-work-orders/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for warranty work order notification:', notification)
          navigate('/warranty-work-orders')
        }
        break
      case 'repair_ticket':
        if (notification.related_entity_id) {
          navigate(`/repair-tickets/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for repair ticket notification:', notification)
          navigate('/repair-tickets')
        }
        break
      case 'warranty_repair_ticket':
        if (notification.related_entity_id) {
          navigate(`/warranty-repair-tickets/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for warranty repair ticket notification:', notification)
          navigate('/warranty-repair-tickets')
        }
        break
      case 'customer':
        if (notification.related_entity_id) {
          navigate(`/customers/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for customer notification:', notification)
          navigate('/customers')
        }
        break
      case 'machine':
        if (notification.related_entity_id) {
          navigate(`/machines/detail/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for machine notification:', notification)
          navigate('/machines')
        }
        break
      case 'inventory':
        if (notification.related_entity_id) {
          navigate(`/inventory/${notification.related_entity_id}`)
        } else {
          console.warn('No related_entity_id found for inventory notification:', notification)
          navigate('/inventory')
        }
        break
      default:
        // For general notifications, just close the menu
        console.log('General notification clicked:', notification)
    }
  }

  const handleViewAllNotifications = () => {
    handleClose()
    navigate('/notifications')
  }

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

  const getPriorityIcon = (type) => {
    if (type === 'high') {
      return <PriorityHighIcon color="error" fontSize="small" />
    }
    return null
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

  const filteredNotifications = React.useMemo(() => {
    if (!notifications.data?.notifications) return []
    
    let filtered = notifications.data.notifications

    // Filter by tab
    if (activeTab === 1) {
      filtered = filtered.filter(n => !n.is_read)
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType)
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(n => {
        const translatedContent = translateNotificationContent(n)
        return translatedContent.title.toLowerCase().includes(query) || 
               translatedContent.message.toLowerCase().includes(query)
      })
    }

    return filtered
  }, [notifications.data?.notifications, activeTab, filterType, searchQuery])

  const unreadNotifications = filteredNotifications.filter(n => !n.is_read)
  const readNotifications = filteredNotifications.filter(n => n.is_read)

  return (
    <>
      <Tooltip title={translate('notifications.notifications')}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{ 
            mr: 1,
            position: 'relative',
            '&:hover': {
              backgroundColor: 'action.hover',
            }
          }}
        >
          <Badge 
            badgeContent={unreadCount.data?.unreadCount || 0} 
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                animation: unreadCount.data?.unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': {
                    boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)',
                  },
                  '70%': {
                    boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)',
                  },
                  '100%': {
                    boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)',
                  },
                },
              },
            }}
          >
            <NotificationsIcon />
          </Badge>
          {/* Subtle WebSocket connection indicator */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4caf50' : '#f44336',
              border: '1px solid white',
              zIndex: 1,
              opacity: 0.8,
              transition: 'opacity 0.3s ease'
            }}
          />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 500,
            maxHeight: 600,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden', // Prevent overflow on the container
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        TransitionComponent={Zoom}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              {translate('notifications.notifications')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={soundEnabled ? translate('notifications.soundOn') : translate('notifications.soundOff')}>
                <IconButton
                  size="small"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  color={soundEnabled ? 'primary' : 'default'}
                >
                  {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title={translate('notifications.refresh')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
                    disabled={notifications.isLoading}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {/* Search and Filter Bar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder={translate('notifications.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: searchQuery && (
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )
              }}
            />
            <Tooltip title={translate('notifications.filter')}>
              <IconButton size="small">
                <FilterListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Tabs */}
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ minHeight: 40 }}>
            <Tab 
              label={`${translate('notifications.all')} (${filteredNotifications.length})`} 
              sx={{ minHeight: 40, fontSize: '0.875rem' }}
            />
            <Tab 
              label={`${translate('notifications.unread')} (${unreadNotifications.length})`} 
              sx={{ minHeight: 40, fontSize: '0.875rem' }}
            />
          </Tabs>
        </Box>

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200, maxHeight: 350 }}>
          {notifications.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.isError ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {translate('common.failedToLoadNotifications')}
            </Alert>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3, color: 'text.secondary' }}>
              <Typography variant="body2">
                {searchQuery ? translate('notifications.noSearchResults') : translate('notifications.noNotifications')}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Unread notifications */}
              {unreadNotifications.map((notification) => (
                <MenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                                     sx={{
                     borderLeft: `3px solid ${theme.palette[getNotificationColor(notification.type)]?.main || theme.palette.primary.main}`,
                     '&:hover': {
                       backgroundColor: 'action.hover',
                     }
                   }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                          <Box component="span" sx={{ 
                            fontWeight: 600, 
                            fontSize: '0.875rem',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {translateNotificationContent(notification).title}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            <Chip
                              label={translate('notifications.new')}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            {getPriorityIcon(notification.type)}
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box component="span" sx={{ 
                            fontSize: '0.875rem', 
                            color: 'text.secondary',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            display: 'block'
                          }}>
                            {translateNotificationContent(notification).message}
                          </Box>
                          <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                            {formatDateTime(notification.created_at)}
                          </Box>
                        </Box>
                      }
                    />
                  </Box>
                </MenuItem>
              ))}

              {/* Read notifications */}
              {readNotifications.map((notification) => (
                <MenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                                     sx={{
                     borderLeft: `3px solid ${theme.palette[getNotificationColor(notification.type)]?.main || theme.palette.primary.main}`,
                     opacity: 0.7,
                     '&:hover': {
                       backgroundColor: 'action.hover',
                     }
                   }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                          <Box component="span" sx={{ 
                            fontWeight: notification.is_read ? 400 : 600, 
                            fontSize: '0.875rem',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {translateNotificationContent(notification).title}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {!notification.is_read && (
                              <Chip
                                label={translate('notifications.new')}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                            {getPriorityIcon(notification.type)}
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box component="span" sx={{ 
                            fontSize: '0.875rem', 
                            color: 'text.secondary',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            display: 'block'
                          }}>
                            {translateNotificationContent(notification).message}
                          </Box>
                          <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                            {formatDateTime(notification.created_at)}
                          </Box>
                        </Box>
                      }
                    />
                  </Box>
                </MenuItem>
              ))}
            </>
          )}
        </Box>

        {/* Footer Actions - Now sticky at bottom */}
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider', 
          bgcolor: 'background.paper',
          flexShrink: 0 // Prevents shrinking
        }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            {(unreadCount.data?.unreadCount || 0) > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllRead}
                disabled={markAllRead.isLoading}
                startIcon={markAllRead.isLoading ? <CircularProgress size={16} /> : <DoneIcon />}
                variant="outlined"
                sx={{ flex: 1 }}
              >
                {translate('notifications.markAllRead')}
              </Button>
            )}
            <Button
              size="small"
              onClick={handleViewAllNotifications}
              variant="contained"
              sx={{ flex: 1 }}
            >
              {translate('notifications.viewAll')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
            {filteredNotifications.length === 1 
              ? translate('notifications.notificationCount', { count: 1, plural: '' })
              : translate('notifications.notificationCount', { count: filteredNotifications.length, plural: 's' })
            }
            {unreadCount.data?.unreadCount > 0 && ` • ${translate('notifications.unreadCount', { count: unreadCount.data.unreadCount })}`}
          </Typography>
        </Box>
      </Menu>
    </>
  )
}


