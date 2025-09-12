import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Progress } from '../components/ui/progress'
import { 
  Users, 
  Server, 
  Activity, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  XCircle,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Eye,
  Settings,
  RefreshCw,
  Download,
  Bell,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { formatCurrency } from '../lib/currency'
import { useAuth } from '../contexts/auth-context'
import { useWebSocket } from '../contexts/websocket-context'
import apiService from '../services/api'

// Types
interface SystemHealth {
  server_status: 'online' | 'offline' | 'warning'
  database_status: 'connected' | 'disconnected' | 'slow'
  api_response_time: number
  memory_usage: number
  cpu_usage: number
  disk_usage: number
  active_connections: number
  uptime: string
}

interface UserActivity {
  id: string
  name: string
  email: string
  role: string
  last_login: string
  status: 'online' | 'offline' | 'away'
  session_duration: string
  actions_count: number
  login_attempts: number
}


interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
}

interface RecentActivity {
  id: string
  user_name: string
  action: string
  entity_type: string
  entity_name: string
  timestamp: string
  ip_address: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, isConnected } = useWebSocket()
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    // Initial load - fetch all data including users
    fetchAdminData()
    // Set up auto-refresh every 5 minutes for non-WebSocket data (system health, alerts, etc.)
    const interval = setInterval(fetchNonUserData, 300000)
    return () => clearInterval(interval)
  }, [])

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleUserActivityUpdate = (data: { userId: string, userName: string, userRole: string, status: string, timestamp: string }) => {
      console.log('Real-time user activity update:', data)
      
      // Update user activity in real-time
      setUserActivity(prev => {
        const updated = [...prev]
        const userIndex = updated.findIndex(u => u.id === data.userId)
        
        if (userIndex >= 0) {
          // Update existing user
          updated[userIndex] = {
            ...updated[userIndex],
            status: data.status as 'online' | 'offline' | 'away',
            session_duration: data.status === 'offline' ? 'N/A' : updated[userIndex].session_duration
          }
        } else {
          // Add new user (if they just came online)
          if (data.status === 'online') {
            updated.unshift({
              id: data.userId,
              name: data.userName,
              email: '', // We don't have email in the WebSocket data
              role: data.userRole,
              last_login: new Date().toISOString(),
              status: 'online',
              session_duration: '0m',
              actions_count: 0,
              login_attempts: 0
            })
          }
        }
        
        return updated
      })
    }

    socket.on('user_activity_update', handleUserActivityUpdate)

    // When WebSocket connects, refresh user data to get current real-time status
    fetchAdminData()

    return () => {
      socket.off('user_activity_update', handleUserActivityUpdate)
    }
  }, [socket, isConnected])

  const fetchAdminData = async () => {
    try {
      setIsLoading(true)
      
      // Debug: Log current user
      console.log('Current user:', user)
      console.log('User role:', user?.role)
      
      // Test the admin endpoint first
      try {
        const testData = await apiService.request('/admin/test')
        console.log('Admin test endpoint response:', testData)
      } catch (testError) {
        console.error('Admin test endpoint failed:', testError)
      }
      
      const [healthData, usersData, alertsData, activityData] = await Promise.all([
        apiService.request('/admin/system-health'),
        apiService.request('/admin/user-activity'),
        apiService.request('/admin/system-alerts'),
        apiService.request('/admin/recent-activity')
      ])

      setSystemHealth(healthData.data)
      setUserActivity(usersData.data)
      setSystemAlerts(alertsData.data)
      setRecentActivity(activityData.data)

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNonUserData = async () => {
    try {
      const [healthData, alertsData, activityData] = await Promise.all([
        apiService.request('/admin/system-health'),
        apiService.request('/admin/system-alerts'),
        apiService.request('/admin/recent-activity')
      ])

      setSystemHealth(healthData.data)
      setSystemAlerts(alertsData.data)
      setRecentActivity(activityData.data)

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching non-user data:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'success':
        return 'text-green-600'
      case 'warning':
      case 'slow':
        return 'text-yellow-600'
      case 'offline':
      case 'disconnected':
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
      case 'slow':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'offline':
      case 'disconnected':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'info':
        return <Eye className="h-4 w-4 text-blue-600" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              System overview and administrative controls
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* WebSocket Connection Status */}
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-muted-foreground">
                {isConnected ? 'Real-time Connected' : 'Disconnected'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNonUserData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="text-sm text-muted-foreground">
              Last updated: {formatDateTime(lastRefresh.toISOString())}
            </div>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Server Status</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth && getStatusIcon(systemHealth.server_status)}
                <span className={`text-sm font-medium ${getStatusColor(systemHealth?.server_status || 'offline')}`}>
                  {systemHealth?.server_status || 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Uptime: {systemHealth?.uptime || 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth && getStatusIcon(systemHealth.database_status)}
                <span className={`text-sm font-medium ${getStatusColor(systemHealth?.database_status || 'disconnected')}`}>
                  {systemHealth?.database_status || 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Response: {systemHealth?.api_response_time || 0}ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userActivity.filter(user => user.status === 'online').length}
              </div>
              <p className="text-xs text-muted-foreground">
                of {userActivity.length} total users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {systemAlerts.filter(alert => !alert.resolved && alert.severity === 'critical').length}
              </div>
              <p className="text-xs text-muted-foreground">
                critical alerts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Recent System Activity
                  </CardTitle>
                  <CardDescription>
                    Latest user actions and system events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserCheck className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activity.user_name} {activity.action} {activity.entity_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(activity.timestamp)} • {activity.ip_address}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Cpu className="h-5 w-5 mr-2" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>CPU Usage</span>
                          <span>{systemHealth.cpu_usage}%</span>
                        </div>
                        <Progress value={systemHealth.cpu_usage} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Memory Usage</span>
                          <span>{systemHealth.memory_usage}%</span>
                        </div>
                        <Progress value={systemHealth.memory_usage} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Disk Usage</span>
                          <span>{systemHealth.disk_usage}%</span>
                        </div>
                        <Progress value={systemHealth.disk_usage} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Network & Connections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wifi className="h-5 w-5 mr-2" />
                    Network & Connections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Active Connections</span>
                        <span className="text-sm font-bold">{systemHealth.active_connections}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">API Response Time</span>
                        <span className="text-sm font-bold">{systemHealth.api_response_time}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Server Uptime</span>
                        <span className="text-sm font-bold">{systemHealth.uptime}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Alerts & Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    System Alerts & Notifications
                  </CardTitle>
                  <CardDescription>
                    Monitor system alerts and critical events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemAlerts.map((alert) => (
                      <div key={alert.id} className={`flex items-start space-x-3 p-4 rounded-lg border ${
                        alert.resolved ? 'bg-muted/50' : 'bg-background'
                      }`}>
                        <div className="flex-shrink-0 mt-1">
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="text-sm font-medium">{alert.title}</h4>
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            {alert.resolved && (
                              <Badge variant="outline">Resolved</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {alert.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(alert.timestamp)}
                          </p>
                        </div>
                        {!alert.resolved && (
                          <Button variant="outline" size="sm">
                            Resolve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Activity & Management
                </CardTitle>
                <CardDescription>
                  Monitor user sessions and activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userActivity.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            user.status === 'online' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <Users className={`h-5 w-5 ${
                              user.status === 'online' ? 'text-green-600' : 'text-gray-600'
                            }`} />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Last login: {formatDateTime(user.last_login)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge variant={user.status === 'online' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">{user.actions_count} actions</p>
                          <p className="text-xs text-muted-foreground">
                            Session: {user.session_duration}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </MainLayout>
  )
}
