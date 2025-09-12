import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Wrench,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Loader2
} from 'lucide-react'
import apiService from '@/services/api'
import { useAuth } from '@/contexts/auth-context'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  description
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600'
      case 'negative':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className="flex items-center space-x-1 text-xs">
            <span className={getChangeColor()}>{change}</span>
            <span className="text-muted-foreground">from last month</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardStats {
  customers: {
    total_customers: number
    active_customers: number
  }
  work_orders: {
    pending_orders: number
    active_orders: number
    completed_orders: number
    high_priority_orders: number
    warranty_pending_orders: number
    warranty_active_orders: number
    warranty_completed_orders: number
    warranty_high_priority_orders: number
    repair_tickets_intake: number
    repair_tickets_converted: number
    warranty_repair_tickets_intake: number
    warranty_repair_tickets_converted: number
  }
  performance: {
    work_order_completion_rate: number
    warranty_completion_rate: number
    repair_ticket_conversion_rate: number
    warranty_repair_ticket_conversion_rate: number
  }
  inventory: {
    total_items: number
    low_stock_items: number
    out_of_stock_items: number
  }
}

export function StatsCards() {
  const { isAuthenticated } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      setStats(response.data)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard statistics')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2"></div>
              <div className="h-3 w-32 bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error || 'Failed to load stats'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const dashboardStats = [
    {
      title: "Total Customers",
      value: Number(stats.customers.total_customers || 0).toLocaleString(),
      icon: Users,
      description: "Active customers in system"
    },
    {
      title: "Open Work Orders",
      value: (Number(stats.work_orders.pending_orders || 0) + Number(stats.work_orders.active_orders || 0)).toString(),
      icon: Wrench,
      description: "Pending and active work orders"
    },
    {
      title: "Open Tickets",
      value: (Number(stats.work_orders.repair_tickets_intake || 0) + Number(stats.work_orders.warranty_repair_tickets_intake || 0)).toString(),
      icon: FileText,
      description: "Pending repair tickets"
    },
    {
      title: "Open Warranty Work Orders",
      value: (Number(stats.work_orders.warranty_pending_orders || 0) + Number(stats.work_orders.warranty_active_orders || 0)).toString(),
      icon: AlertTriangle,
      description: "Pending and active warranty work orders"
    },
    {
      title: "Completion Rate",
      value: `${Number(stats.performance.work_order_completion_rate || 0)}%`,
      icon: CheckCircle,
      description: "Work orders completed"
    },
    {
      title: "Open Warranty Tickets",
      value: Number(stats.work_orders.warranty_repair_tickets_intake || 0).toString(),
      icon: TrendingUp,
      description: "Pending warranty repair tickets"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {dashboardStats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  )
}
