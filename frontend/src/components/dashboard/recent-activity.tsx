import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Clock,
  User,
  Wrench,
  FileText,
  CheckCircle,
  AlertTriangle,
  Plus,
  Loader2
} from 'lucide-react'
import apiService from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface ActivityItem {
  id: string
  type: string
  action_text: string
  formatted_number?: string
  description: string
  status: string
  created_at: string
}

interface RecentActivityData {
  recent_activity: ActivityItem[]
}

const getActivityIcon = (type: string) => {
  if (type.includes('work_order')) return CheckCircle
  if (type.includes('ticket')) return FileText
  if (type.includes('customer')) return User
  if (type.includes('machine')) return Wrench
  if (type.includes('inventory')) return Plus
  return Plus
}

const getStatusBadge = (status: string) => {
  return (
    <Badge 
      variant={getStatusBadgeVariant(status)} 
      className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : undefined}
    >
      {formatStatus(status)}
    </Badge>
  )
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
  return date.toLocaleDateString()
}

export function RecentActivity() {
  const { isAuthenticated } = useAuth()
  const [activityData, setActivityData] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentActivity()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchRecentActivity = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      setActivityData(response.data.recent_activity || [])
    } catch (err) {
      console.error('Error fetching recent activity:', err)
      setError('Failed to load recent activity')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded mb-2"></div>
                  <div className="h-3 w-32 bg-muted animate-pulse rounded mb-1"></div>
                  <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
                </div>
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
            <Clock className="h-5 w-5" />
            <span>Recent Activity</span>
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
          <Clock className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activityData.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            activityData.slice(0, 10).map((activity) => {
              const Icon = getActivityIcon(activity.type)
              return (
                <div key={`${activity.type}-${activity.id}`} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {activity.action_text}
                      </p>
                      {getStatusBadge(activity.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.formatted_number && `${activity.formatted_number} - `}
                      {activity.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {activityData.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <button className="text-sm text-primary hover:underline">
              View all activity
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
