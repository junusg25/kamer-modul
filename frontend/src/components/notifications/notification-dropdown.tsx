import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNotifications, type Notification } from '@/contexts/notifications-context'
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Loader2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'work_order':
    case 'warranty_work_order':
      return '🔧'
    case 'repair_ticket':
    case 'warranty_repair_ticket':
      return '🎫'
    case 'customer':
      return '👤'
    case 'machine':
      return '⚙️'
    case 'inventory':
      return '📦'
    case 'system':
      return '⚙️'
    case 'feedback':
      return '💬'
    case 'success':
      return '✅'
    case 'warning':
      return '⚠️'
    case 'error':
      return '❌'
    default:
      return 'ℹ️'
  }
}

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'work_order':
    case 'warranty_work_order':
      return 'text-blue-600 dark:text-blue-400'
    case 'repair_ticket':
    case 'warranty_repair_ticket':
      return 'text-purple-600 dark:text-purple-400'
    case 'customer':
      return 'text-indigo-600 dark:text-indigo-400'
    case 'machine':
      return 'text-muted-foreground'
    case 'inventory':
      return 'text-orange-600 dark:text-orange-400'
    default:
      return 'text-muted-foreground'
  }
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: number) => void
  onDelete: (id: number) => void
  onNavigate: (notification: Notification) => void
}

function NotificationItem({ notification, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
    onNavigate(notification)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(notification.id)
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer transition-colors",
        "hover:bg-muted/50",
        !notification.is_read && "bg-blue-50/50 border-l-2 border-l-blue-500"
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex-shrink-0 mt-0.5">
        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              !notification.is_read && "font-semibold"
            )}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
          </div>
          
          {isHovered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
          
          {!notification.is_read && (
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificationDropdown() {
  const navigate = useNavigate()
  
  // Simple fallback for now to test if the issue is with the context
  const [isOpen, setIsOpen] = useState(false)
  
  // Try to get notifications context, but provide fallback values
  let notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification, deleteAllRead
  
  try {
    const context = useNotifications()
    notifications = context.notifications
    unreadCount = context.unreadCount
    isLoading = context.isLoading
    markAsRead = context.markAsRead
    markAllAsRead = context.markAllAsRead
    deleteNotification = context.deleteNotification
    deleteAllRead = context.deleteAllRead
  } catch (error) {
    console.error('Notifications context error:', error)
    // Provide fallback values
    notifications = []
    unreadCount = 0
    isLoading = false
    markAsRead = () => {}
    markAllAsRead = () => {}
    deleteNotification = () => {}
    deleteAllRead = () => {}
  }

  const handleNotificationClick = (notification: Notification) => {
    // Navigate based on notification type and related entity
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
        case 'warranty_repair_ticket':
          navigate(`/warranty-repair-tickets/${notification.related_entity_id}`)
          break
        case 'customer':
          navigate(`/customers/${notification.related_entity_id}`)
          break
        case 'machine':
          navigate(`/machines/${notification.related_entity_id}`)
          break
        case 'inventory':
          navigate(`/inventory/${notification.related_entity_id}`)
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
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  const handleDeleteAllRead = () => {
    deleteAllRead()
  }

  const handleViewAll = () => {
    navigate('/notifications')
    setIsOpen(false)
  }

  const recentNotifications = notifications.slice(0, 5)
  const hasReadNotifications = notifications.some(n => n.is_read)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            
            {hasReadNotifications && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={handleDeleteAllRead}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see updates about your work here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification, index) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onNavigate={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {recentNotifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={handleViewAll}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
