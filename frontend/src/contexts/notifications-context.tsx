import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from './auth-context'
import { useWebSocket } from './websocket-context'
import { apiService } from '../services/api'

export interface Notification {
  id: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'work_order' | 'warranty_work_order' | 'repair_ticket' | 'inventory' | 'customer' | 'machine' | 'system'
  is_read: boolean
  related_entity_type?: string
  related_entity_id?: number
  created_at: string
}

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  fetchNotifications: (page?: number, limit?: number) => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  deleteAllRead: () => Promise<void>
  deleteMultiple: (ids: number[]) => Promise<void>
  // Real-time updates
  addNotification: (notification: Notification) => void
  updateUnreadCount: (count: number) => void
  // Local toast notifications (for immediate feedback)
  addToastNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const { user, isAuthenticated } = useAuth()
  const { socket, isConnected } = useWebSocket()

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async (page = 1, limit = 20) => {
    if (!isAuthenticated) return

    try {
      setIsLoading(true)
      const response = await apiService.request(`/notifications?page=${page}&limit=${limit}`)
      setNotifications(response.notifications || [])
      
      // Update unread count
      const unreadResponse = await apiService.request('/notifications/unread-count')
      setUnreadCount(unreadResponse.unreadCount || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  // Mark notification as read
  const markAsRead = useCallback(async (id: number) => {
    try {
      await apiService.request(`/notifications/${id}/mark-read`, { method: 'PATCH' })
      
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      )
      
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiService.request('/notifications/mark-all-read', { method: 'PATCH' })
      
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      )
      
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
    }
  }, [])

  // Delete notification
  const deleteNotification = useCallback(async (id: number) => {
    try {
      await apiService.request(`/notifications/${id}`, { method: 'DELETE' })
      
      setNotifications(prev => prev.filter(notification => notification.id !== id))
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === id)
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      // Emit event to refresh sidebar counts
      window.dispatchEvent(new CustomEvent('notificationsChanged'))
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Failed to delete notification')
    }
  }, [notifications])

  // Delete all read notifications
  const deleteAllRead = useCallback(async () => {
    try {
      await apiService.request('/notifications/delete-read', { method: 'DELETE' })
      
      setNotifications(prev => prev.filter(notification => !notification.is_read))
      
      // Emit event to refresh sidebar counts
      window.dispatchEvent(new CustomEvent('notificationsChanged'))
      
      toast.success('All read notifications deleted')
    } catch (error) {
      console.error('Error deleting read notifications:', error)
      toast.error('Failed to delete read notifications')
    }
  }, [])

  // Delete multiple notifications
  const deleteMultiple = useCallback(async (ids: number[]) => {
    try {
      await apiService.request('/notifications/delete-multiple', {
        method: 'POST',
        body: JSON.stringify({ ids })
      })
      
      setNotifications(prev => prev.filter(notification => !ids.includes(notification.id)))
      
      // Update unread count
      const deletedUnreadCount = notifications.filter(n => ids.includes(n.id) && !n.is_read).length
      setUnreadCount(prev => Math.max(0, prev - deletedUnreadCount))
      
      // Emit event to refresh sidebar counts
      window.dispatchEvent(new CustomEvent('notificationsChanged'))
      
      toast.success(`${ids.length} notifications deleted`)
    } catch (error) {
      console.error('Error deleting multiple notifications:', error)
      toast.error('Failed to delete notifications')
    }
  }, [notifications])

  // Add notification (for real-time updates)
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev])
    
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1)
    }

    // Show toast notification
    const getToastType = (type: string) => {
      switch (type) {
        case 'success': return 'success'
        case 'error': return 'error'
        case 'warning': return 'warning'
        default: return 'info'
      }
    }

    toast[getToastType(notification.type)](notification.title, {
      description: notification.message,
    })
  }, [])

  // Update unread count (for real-time updates)
  const updateUnreadCount = useCallback((count: number) => {
    setUnreadCount(count)
  }, [])

  // Add local toast notification (for immediate feedback)
  const addToastNotification = useCallback((notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'title_key' | 'message_key' | 'message_params'>) => {
    const getToastType = (type: string) => {
      switch (type) {
        case 'success': return 'success'
        case 'error': return 'error'
        case 'warning': return 'warning'
        default: return 'info'
      }
    }

    toast[getToastType(notification.type)](notification.title, {
      description: notification.message,
    })
  }, [])

  // WebSocket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleNotificationReceived = (data: { notification: Notification }) => {
      addNotification(data.notification)
    }

    const handleNotificationCountUpdated = (data: { userId: number }) => {
      if (data.userId === user?.id) {
        fetchNotifications()
      }
    }

    socket.on('notification_received', handleNotificationReceived)
    socket.on('notification_count_updated', handleNotificationCountUpdated)

    return () => {
      socket.off('notification_received', handleNotificationReceived)
      socket.off('notification_count_updated', handleNotificationCountUpdated)
    }
  }, [socket, isConnected, user?.id, addNotification, fetchNotifications])

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated, fetchNotifications])

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllRead,
        deleteMultiple,
        addNotification,
        updateUnreadCount,
        addToastNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
