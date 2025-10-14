import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination } from '@/components/ui/pagination'
import { useNotifications, type Notification } from '@/contexts/notifications-context'
import {
  Bell,
  CheckCheck,
  Trash2,
  Loader2,
  RefreshCw,
  Check,
  Clock,
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
    case 'machine':
      return <Package className="h-5 w-5 text-slate-600" />
    case 'customer':
      return <User className="h-5 w-5 text-slate-600" />
    case 'inventory':
      return <Package className="h-5 w-5 text-slate-600" />
    case 'system':
    case 'info':
    case 'success':
    case 'warning':
    case 'error':
      return <MessageSquare className="h-5 w-5 text-slate-600" />
    default:
      return <Bell className="h-5 w-5 text-slate-600" />
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
  onClick: (notification: Notification) => void
}

function NotificationItem({ 
  notification, 
  isSelected, 
  onSelect, 
  onMarkAsRead, 
  onDelete, 
  onClick 
}: NotificationItemProps) {
  const handleSelect = (checked: boolean) => {
    onSelect(notification.id, checked)
  }

  const handleClick = () => {
    onClick(notification)
  }

  const handleDelete = () => {
    onDelete(notification.id)
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 border rounded-xl transition-all duration-200",
        "hover:shadow-md cursor-pointer group relative",
        // Enhanced unread styling
        !notification.is_read && [
          "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500 shadow-sm",
          "ring-1 ring-blue-100 dark:ring-blue-900/50"
        ],
        // Selected state
        isSelected && "bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 shadow-md",
        // Read state
        notification.is_read && "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
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
                !notification.is_read 
                  ? "text-slate-900 dark:text-slate-100 font-bold" 
                  : "text-slate-700 dark:text-slate-300"
              )}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                    New
                  </span>
                </div>
              )}
            </div>
            <p className={cn(
              "text-sm line-clamp-2 mb-2",
              !notification.is_read 
                ? "text-slate-700 dark:text-slate-200 font-medium" 
                : "text-muted-foreground"
            )}>
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
                className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300"
                title="Mark as read"
              >
                <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                  <XCircle className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
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
  
  const [activeTab, setActiveTab] = useState<string>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  // Calculate tab counts
  const tabCounts = {
    all: notifications.length,
    unread: notifications.filter(n => !n.is_read).length,
    work_orders: notifications.filter(n => n.type === 'work_order' || n.type === 'warranty_work_order').length,
    repair_tickets: notifications.filter(n => n.type === 'repair_ticket' || n.type === 'warranty_repair_ticket').length,
    machines: notifications.filter(n => n.type === 'machine').length,
    system: notifications.filter(n => n.type === 'system' || n.type === 'info' || n.type === 'success' || n.type === 'warning' || n.type === 'error').length,
    customers: notifications.filter(n => n.type === 'customer').length,
    inventory: notifications.filter(n => n.type === 'inventory').length
  }

  // Filter and sort notifications (unread first, then by date)
  const filteredNotifications = notifications
    .filter(notification => {
      // Tab-based filtering
      let matchesTab = true
      switch (activeTab) {
        case 'unread':
          matchesTab = !notification.is_read
          break
        case 'work_orders':
          matchesTab = notification.type === 'work_order' || notification.type === 'warranty_work_order'
          break
        case 'repair_tickets':
          matchesTab = notification.type === 'repair_ticket' || notification.type === 'warranty_repair_ticket'
          break
        case 'machines':
          matchesTab = notification.type === 'machine'
          break
        case 'system':
          matchesTab = ['system', 'info', 'success', 'warning', 'error'].includes(notification.type)
          break
        case 'customers':
          matchesTab = notification.type === 'customer'
          break
        case 'inventory':
          matchesTab = notification.type === 'inventory'
          break
        case 'all':
        default:
          matchesTab = true
          break
      }
      
      return matchesTab
    })
    .sort((a, b) => {
      // First sort by read status (unread first)
      if (a.is_read !== b.is_read) {
        return a.is_read ? 1 : -1
      }
      // Then sort by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  // Pagination logic
  const totalItems = filteredNotifications.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(new Set(paginatedNotifications.map(n => n.id)))
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
          case 'machine':
            navigate(`/machines/${notification.related_entity_id}`)
            break
          case 'customer':
            navigate(`/customers/${notification.related_entity_id}`)
            break
          default:
            navigate('/notifications')
        }
      } else {
        // Fallback to notifications page
        navigate('/notifications')
      }
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback to notifications page
      navigate('/notifications')
    }
  }

  const handleRefresh = () => {
    fetchNotifications(1, pageSize)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setSelectedNotifications(new Set()) // Clear selection when changing pages
  }

  const allSelected = paginatedNotifications.length > 0 && 
    paginatedNotifications.every(n => selectedNotifications.has(n.id))
  const someSelected = paginatedNotifications.some(n => selectedNotifications.has(n.id))

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {totalItems} notifications • {unreadCount} unread
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

        {/* Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  All
                  <Badge variant="secondary" className="ml-1">
                    {tabCounts.all}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="unread" className="flex items-center gap-2">
                  Unread
                  <Badge variant="destructive" className="ml-1">
                    {tabCounts.unread}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="work_orders" className="flex items-center gap-2">
                  Work Orders
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.work_orders}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="repair_tickets" className="flex items-center gap-2">
                  Tickets
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.repair_tickets}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="machines" className="flex items-center gap-2">
                  Machines
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.machines}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center gap-2">
                  Customers
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.customers}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="inventory" className="flex items-center gap-2">
                  Inventory
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.inventory}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  System
                  <Badge variant="outline" className="ml-1">
                    {tabCounts.system}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
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
                    <Check className="h-4 w-4 mr-2" />
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
          <CardContent className="p-0">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab !== 'all'
                    ? 'Try adjusting your filters to see more notifications.'
                    : 'You\'ll see updates about your work here when they arrive.'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {paginatedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isSelected={selectedNotifications.has(notification.id)}
                    onSelect={handleSelectNotification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </MainLayout>
  )
}
