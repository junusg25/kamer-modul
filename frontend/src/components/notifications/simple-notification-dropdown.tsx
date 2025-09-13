import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  MoreHorizontal,
  ExternalLink,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from 'lucide-react'
import { useNotifications } from '@/contexts/notifications-context'
import { cn } from '@/lib/utils'

// Helper functions for notification display
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'work_order':
    case 'warranty_work_order':
      return <CheckCircle className="h-4 w-4 text-blue-500" />
    case 'repair_ticket':
    case 'warranty_repair_ticket':
      return <AlertCircle className="h-4 w-4 text-orange-500" />
    case 'customer':
      return <Info className="h-4 w-4 text-green-500" />
    case 'machine':
      return <AlertTriangle className="h-4 w-4 text-purple-500" />
    case 'inventory':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'system':
      return <Info className="h-4 w-4 text-gray-500" />
    case 'feedback':
      return <Bell className="h-4 w-4 text-blue-500" />
    default:
      return <Bell className="h-4 w-4 text-gray-500" />
  }
}

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'work_order':
    case 'warranty_work_order':
      return 'border-l-blue-500 bg-blue-50'
    case 'repair_ticket':
    case 'warranty_repair_ticket':
      return 'border-l-orange-500 bg-orange-50'
    case 'customer':
      return 'border-l-green-500 bg-green-50'
    case 'machine':
      return 'border-l-purple-500 bg-purple-50'
    case 'inventory':
      return 'border-l-red-500 bg-red-50'
    case 'system':
      return 'border-l-gray-500 bg-gray-50'
    case 'feedback':
      return 'border-l-blue-500 bg-blue-50'
    default:
      return 'border-l-gray-300 bg-gray-50'
  }
}

const formatTimeAgo = (dateString: string) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function SimpleNotificationDropdown() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Get notifications from context
  const { notifications, unreadCount, isLoading, markAsRead, deleteNotification } = useNotifications()
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const handleViewAll = () => {
    navigate('/notifications')
    setIsOpen(false)
  }
  
  const handleNotificationClick = (notification: any) => {
    try {
      // Mark as read first
      if (!notification.is_read) {
        markAsRead(notification.id)
      }
      
      // Navigate based on notification type
      if (notification.related_entity_type && notification.related_entity_id) {
        switch (notification.related_entity_type) {
          case 'warranty_repair_ticket':
            navigate(`/warranty-repair-tickets/${notification.related_entity_id}`)
            break
          case 'repair_ticket':
            navigate(`/repair-tickets/${notification.related_entity_id}`)
            break
          case 'work_order':
            navigate(`/work-orders/${notification.related_entity_id}`)
            break
          case 'warranty_work_order':
            navigate(`/warranty-work-orders/${notification.related_entity_id}`)
            break
          case 'customer':
            navigate(`/customers/${notification.related_entity_id}`)
            break
          case 'machine':
            navigate(`/machines/${notification.related_entity_id}`)
            break
          case 'feedback':
            navigate('/admin-feedback')
            break
          default:
            navigate('/notifications')
        }
      } else {
        navigate('/notifications')
      }
      setIsOpen(false)
    } catch (error) {
      console.error('Navigation error:', error)
      navigate('/notifications')
    }
  }
  
  const handleMarkAsRead = (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation()
    markAsRead(notificationId)
  }
  
  const handleDelete = (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation()
    deleteNotification(notificationId)
  }


  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn(
          "relative",
          isOpen && "bg-accent"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                {unreadCount} new
              </Badge>
            )}
          </div>
          
          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No notifications yet</p>
                <p className="text-xs text-gray-500">
                  You'll see updates about your work here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.slice(0, 5).map((notification: any) => (
                  <div 
                    key={notification.id} 
                    className={cn(
                      "p-4 hover:bg-gray-50 cursor-pointer transition-all duration-150 border-l-4",
                      getNotificationColor(notification.type),
                      !notification.is_read && "bg-blue-50/50"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium",
                              !notification.is_read ? "text-gray-900" : "text-gray-700"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(notification.created_at)}
                              </span>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-2">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-blue-100"
                                onClick={(e) => handleMarkAsRead(e, notification.id)}
                                title="Mark as read"
                              >
                                <Check className="h-3 w-3 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-red-100"
                              onClick={(e) => handleDelete(e, notification.id)}
                              title="Delete notification"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs hover:bg-gray-100"
              onClick={handleViewAll}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              Check all notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
