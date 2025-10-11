import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Clock,
  User,
  Wrench,
  ChevronRight,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService from '@/services/api'
import { useAuth } from '@/contexts/auth-context'

interface PriorityAlert {
  id: string
  type: 'urgent' | 'overdue' | 'low_stock' | 'warranty_expiring'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  timestamp: string
  count?: number
}

interface DashboardStats {
  work_orders: {
    high_priority_orders: number
    warranty_high_priority_orders: number
  }
  inventory: {
    low_stock_items: number
    out_of_stock_items: number
  }
}

const getAlertIcon = (type: PriorityAlert['type']) => {
  switch (type) {
    case 'urgent':
      return AlertTriangle
    case 'overdue':
      return Clock
    case 'low_stock':
      return Wrench
    case 'warranty_expiring':
      return User
    default:
      return AlertTriangle
  }
}

const getPriorityColor = (priority: PriorityAlert['priority']) => {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'medium':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'low':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

const getPriorityBadge = (priority: PriorityAlert['priority']) => {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">High Priority</Badge>
    case 'medium':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Medium Priority</Badge>
    case 'low':
      return <Badge variant="outline" className="border-yellow-300 text-yellow-700">Low Priority</Badge>
    default:
      return null
  }
}

export function PriorityAlerts() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<PriorityAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchPriorityAlerts()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const handleAlertClick = (alert: PriorityAlert) => {
    if (alert.id === 'high-priority-regular') {
      // Navigate to work orders page with high priority filter
      navigate('/work-orders?priority=high')
    } else if (alert.id === 'high-priority-warranty') {
      // Navigate to warranty work orders page with high priority filter
      navigate('/warranty-work-orders?priority=high')
    } else if (alert.id === 'low-stock' || alert.id === 'out-of-stock') {
      // Navigate to inventory page
      navigate('/inventory')
    }
  }

  const fetchPriorityAlerts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      const stats = response.data
      
      // Debug logging to understand the data
      
      
      // Generate alerts based on real data
      const generatedAlerts: PriorityAlert[] = []
      
      // High priority work orders alert
      const regularHighPriority = stats.work_orders.high_priority_orders || 0
      const warrantyHighPriority = stats.work_orders.warranty_high_priority_orders || 0
      const totalHighPriority = regularHighPriority + warrantyHighPriority
      
      if (totalHighPriority > 0) {
        // Create separate alerts for regular and warranty work orders if both exist
        if (regularHighPriority > 0 && warrantyHighPriority > 0) {
          // Show separate alerts
          generatedAlerts.push({
            id: 'high-priority-regular',
            type: 'urgent',
            title: 'High Priority Work Orders',
            description: `${regularHighPriority} regular work orders require immediate attention`,
            priority: 'high',
            timestamp: 'Just now',
            count: regularHighPriority
          })
          generatedAlerts.push({
            id: 'high-priority-warranty',
            type: 'urgent',
            title: 'High Priority Warranty Work Orders',
            description: `${warrantyHighPriority} warranty work orders require immediate attention`,
            priority: 'high',
            timestamp: 'Just now',
            count: warrantyHighPriority
          })
        } else if (regularHighPriority > 0) {
          // Only regular work orders
          generatedAlerts.push({
            id: 'high-priority-regular',
            type: 'urgent',
            title: 'High Priority Work Orders',
            description: `${regularHighPriority} work orders require immediate attention`,
            priority: 'high',
            timestamp: 'Just now',
            count: regularHighPriority
          })
        } else if (warrantyHighPriority > 0) {
          // Only warranty work orders
          generatedAlerts.push({
            id: 'high-priority-warranty',
            type: 'urgent',
            title: 'High Priority Warranty Work Orders',
            description: `${warrantyHighPriority} warranty work orders require immediate attention`,
            priority: 'high',
            timestamp: 'Just now',
            count: warrantyHighPriority
          })
        }
      }
      
      // Low stock alert
      if (stats.inventory.low_stock_items > 0) {
        generatedAlerts.push({
          id: 'low-stock',
          type: 'low_stock',
          title: 'Low Stock Alert',
          description: `${stats.inventory.low_stock_items} inventory items are running low`,
          priority: 'medium',
          timestamp: 'Recently',
          count: stats.inventory.low_stock_items
        })
      }
      
      // Out of stock alert
      if (stats.inventory.out_of_stock_items > 0) {
        generatedAlerts.push({
          id: 'out-of-stock',
          type: 'low_stock',
          title: 'Out of Stock Items',
          description: `${stats.inventory.out_of_stock_items} inventory items are out of stock`,
          priority: 'high',
          timestamp: 'Recently',
          count: stats.inventory.out_of_stock_items
        })
      }
      
      setAlerts(generatedAlerts)
    } catch (err) {
      console.error('Error fetching priority alerts:', err)
      setError('Failed to load priority alerts')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Priority Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-3 rounded-lg border bg-muted animate-pulse">
                <div className="h-4 w-32 bg-muted-foreground/20 rounded mb-2"></div>
                <div className="h-3 w-48 bg-muted-foreground/20 rounded mb-2"></div>
                <div className="h-3 w-24 bg-muted-foreground/20 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Priority Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span>Priority Alerts</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No priority alerts</p>
              <p className="text-xs text-muted-foreground mt-1">All systems running smoothly</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const Icon = getAlertIcon(alert.type)
              const isClickable = alert.id === 'high-priority-regular' || alert.id === 'high-priority-warranty' || alert.id === 'low-stock' || alert.id === 'out-of-stock'
              
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${getPriorityColor(alert.priority)} ${
                    isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                  }`}
                  onClick={() => isClickable && handleAlertClick(alert)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium">{alert.title}</h4>
                          {alert.count && (
                            <Badge variant="outline" className="text-xs">
                              {alert.count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm opacity-90 mb-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs opacity-75">
                            {alert.timestamp}
                          </span>
                          {getPriorityBadge(alert.priority)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {isClickable && (
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {alerts.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full">
              View All Alerts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
