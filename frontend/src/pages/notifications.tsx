import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotifications, type Notification } from '@/contexts/notifications-context'
import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Clock,
  Settings,
  Archive,
  Star,
  Check,
  Wrench,
  FileText,
  User,
  Package,
  MessageSquare,
  XCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'work_order':
    case 'warranty_work_order':
      return <Wrench className="h-5 w-5 text-slate-600" />
    case 'repair_ticket':
    case 'warranty_repair_ticket':
      return <FileText className="h-5 w-5 text-slate-600" />
    case 'customer':
      return <User className="h-5 w-5 text-slate-600" />
    case 'machine':
      return <Package className="h-5 w-5 text-slate-600" />
    case 'inventory':
      return <Archive className="h-5 w-5 text-slate-600" />
    case 'system':
      return <Settings className="h-5 w-5 text-slate-600" />
    case 'feedback':
      return <MessageSquare className="h-5 w-5 text-slate-600" />
    case 'success':
      return <CheckCircle className="h-5 w-5 text-emerald-600" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-600" />
    case 'error':
      return <XCircle className="h-5 w-5 text-red-600" />
    default:
      return <Bell className="h-5 w-5 text-slate-600" />
  }
}

const getNotificationTypeIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600" />
    default:
      return <Info className="h-4 w-4 text-blue-600" />
  }
}

const getNotificationTypeColor = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

interface NotificationItemProps {
  notification: Notification
  isSelected: boolean
  onSelect: (id: number, selected: boolean) => void
  onMarkAsRead: (id: number) => void
  onDelete: (id: number) => void
  onNavigate: (notification: Notification) => void
}

function NotificationItem({ 
  notification, 
  isSelected, 
  onSelect, 
  onMarkAsRead, 
  onDelete, 
  onNavigate 
}: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
    onNavigate(notification)
  }

  const handleSelect = (checked: boolean) => {
    onSelect(notification.id, checked)
  }

  const handleDelete = () => {
    onDelete(notification.id)
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 border rounded-xl transition-all duration-200",
        "hover:shadow-md cursor-pointer group",
        !notification.is_read && "bg-blue-50/50 border-blue-200 shadow-sm",
        isSelected && "bg-blue-100 border-blue-300 shadow-md"
      )}
      onClick={handleClick}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={handleSelect}
        onClick={(e) => e.stopPropagation()}
        className="mt-1"
      />
      
      <div className="flex-shrink-0 mt-1">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          getNotificationTypeColor(notification.type)
        )}>
          {getNotificationIcon(notification.type)}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "text-sm font-semibold",
                !notification.is_read ? "text-foreground" : "text-muted-foreground"
              )}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {notification.message}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
              </div>
              <Badge 
                variant="outline" 
                className={cn("text-xs", getNotificationTypeColor(notification.type))}
              >
                {notification.type.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkAsRead(notification.id)
                }}
                className="h-8 w-8 p-0 hover:bg-blue-100"
                title="Mark as read"
              >
                <Check className="h-4 w-4 text-blue-600" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete()
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    fetchNotifications,
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAllRead,
    deleteMultiple
  } = useNotifications()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = !searchTerm || 
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === 'all' || notification.type === typeFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'unread' && !notification.is_read) ||
      (statusFilter === 'read' && notification.is_read)
    
    return matchesSearch && matchesType && matchesStatus
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)))
    } else {
      setSelectedNotifications(new Set())
    }
  }

  const handleSelectNotification = (id: number, selected: boolean) => {
    const newSelected = new Set(selectedNotifications)
    if (selected) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedNotifications(newSelected)
  }

  const handleDeleteSelected = () => {
    if (selectedNotifications.size > 0) {
      deleteMultiple(Array.from(selectedNotifications))
      setSelectedNotifications(new Set())
    }
  }

  const handleMarkSelectedAsRead = () => {
    const unreadSelected = Array.from(selectedNotifications).filter(id => {
      const notification = notifications.find(n => n.id === id)
      return notification && !notification.is_read
    })
    
    unreadSelected.forEach(id => markAsRead(id))
    setSelectedNotifications(new Set())
  }

  const handleNotificationClick = (notification: Notification) => {
    try {
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
            
        }
      } else {
        
      }
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback to notifications page
      navigate('/notifications')
    }
  }

  const handleRefresh = () => {
    fetchNotifications(1, 20)
    setCurrentPage(1)
  }

  const handleLoadMore = () => {
    const nextPage = currentPage + 1
    fetchNotifications(nextPage, 20)
    setCurrentPage(nextPage)
  }


  const allSelected = filteredNotifications.length > 0 && 
    filteredNotifications.every(n => selectedNotifications.has(n.id))
  const someSelected = filteredNotifications.some(n => selectedNotifications.has(n.id))

  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type)))

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">
              Stay updated with your latest activities and system alerts
            </p>
          </div>
          
                 <div className="flex items-center gap-2">
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={handleRefresh}
                     disabled={isLoading}
                   >
                     <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                     Refresh
                   </Button>
                   
                   
                   {unreadCount > 0 && (
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={markAllAsRead}
                     >
                       <CheckCheck className="h-4 w-4 mr-2" />
                       Mark all read
                     </Button>
                   )}
                 </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {notifications.length - unreadCount}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Selected</CardTitle>
              <CheckCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedNotifications.size}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters & Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Bulk Actions */}
            {someSelected && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedNotifications.size} selected
                </span>
                
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkSelectedAsRead}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>
              {filteredNotifications.length} of {notifications.length} notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters to see more notifications.'
                    : 'You\'ll see updates about your work here when they arrive.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isSelected={selectedNotifications.has(notification.id)}
                    onSelect={handleSelectNotification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onNavigate={handleNotificationClick}
                  />
                ))}
                
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
