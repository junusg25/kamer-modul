import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { toast } from 'sonner'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

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
  account_status?: 'active' | 'inactive'
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

// Define columns for User Management table
const USER_MANAGEMENT_COLUMNS = defineColumns([
  { key: 'user', label: 'User' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'session', label: 'Session' },
  { key: 'actions', label: 'Actions' },
  { key: 'last_login', label: 'Last Login' },
])

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, isConnected } = useWebSocket()
  const { t } = useTranslation()
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  // User management dialog state
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null)
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: '',
    status: '',
    password: '',
    confirmPassword: ''
  })
  const [isSavingUser, setIsSavingUser] = useState(false)

  // Column visibility hook for User Management
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('admin_user_management', getDefaultColumnKeys(USER_MANAGEMENT_COLUMNS))

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
      
      
      // Update user activity in real-time
      setUserActivity(prev => {
        const updated = [...prev]
        const userIndex = updated.findIndex(u => u.id === data.userId)
        
        if (userIndex >= 0) {
          // Update existing user
          updated[userIndex] = {
            ...updated[userIndex],
            status: data.status as 'online' | 'offline' | 'away',
            session_duration: data.status === 'offline' ? t('pages.admin.na') : updated[userIndex].session_duration
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
      
      
      
      // Test the admin endpoint first
      try {
        const testData = await apiService.request('/admin/test')
        
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

  const handleEditUser = (user: UserActivity) => {
    setSelectedUser(user)
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.account_status || 'active',
      password: '',
      confirmPassword: ''
    })
    setIsUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!selectedUser) return

    // Validate password if provided
    if (userFormData.password && userFormData.password !== userFormData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (userFormData.password && userFormData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    try {
      setIsSavingUser(true)
      
      const updateData: any = {
        name: userFormData.name,
        email: userFormData.email,
        role: userFormData.role,
        status: userFormData.status
      }

      // Only include password if it was provided
      if (userFormData.password) {
        updateData.password = userFormData.password
      }

      await apiService.request(`/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      })

      toast.success('User updated successfully')
      setIsUserDialogOpen(false)
      fetchAdminData() // Refresh data
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error(error.message || 'Failed to update user')
    } finally {
      setIsSavingUser(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('common:navigation.admin_dashboard')}</h1>
            <p className="text-muted-foreground">
              {t('pages.admin.system_overview')} and {t('pages.admin.administrative_controls').toLowerCase()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* WebSocket Connection Status */}
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-muted-foreground">
                {isConnected ? t('pages.admin.real_time_connected') : t('pages.admin.disconnected')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNonUserData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <div className="text-sm text-muted-foreground">
              {t('pages.admin.last_updated')}: {formatDateTime(lastRefresh.toISOString())}
            </div>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.admin.server_status')}</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth && getStatusIcon(systemHealth.server_status)}
                <span className={`text-sm font-medium ${getStatusColor(systemHealth?.server_status || 'offline')}`}>
                  {systemHealth?.server_status || t('loading') + '...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('pages.admin.uptime')}: {systemHealth?.uptime || t('pages.admin.na')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.admin.database')}</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {systemHealth && getStatusIcon(systemHealth.database_status)}
                <span className={`text-sm font-medium ${getStatusColor(systemHealth?.database_status || 'disconnected')}`}>
                  {systemHealth?.database_status || t('loading') + '...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('pages.admin.response')}: {systemHealth?.api_response_time || 0}ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.admin.active_users')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userActivity.filter(user => user.status === 'online').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('of')} {userActivity.length} {t('pages.admin.total_users')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.admin.system_alerts')}</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {systemAlerts.filter(alert => !alert.resolved && alert.severity === 'critical').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('pages.admin.critical_alerts')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="users">{t('tabs.user_management')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    {t('pages.admin.recent_system_activity')}
                  </CardTitle>
                  <CardDescription>
                    {t('pages.admin.latest_user_actions')}
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
                    {t('pages.admin.performance_metrics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t('pages.admin.memory_usage_heap')}</span>
                          <span>{systemHealth.memory_usage}%</span>
                        </div>
                        <Progress value={systemHealth.memory_usage} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t('pages.admin.active_db_connections')}</span>
                          <span>{systemHealth.active_connections}</span>
                        </div>
                        <Progress value={Math.min((systemHealth.active_connections / 20) * 100, 100)} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('pages.admin.max_pool_size')}: 20
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t('pages.admin.api_response_time')}</span>
                          <span>{systemHealth.api_response_time}ms</span>
                        </div>
                        <Progress value={Math.min((systemHealth.api_response_time / 1000) * 100, 100)} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('pages.admin.target_response_time')}: &lt; 1000ms
                        </p>
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
                    {t('pages.admin.network_connections')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('pages.admin.active_connections')}</span>
                        <span className="text-sm font-bold">{systemHealth.active_connections}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('pages.admin.api_response_time')}</span>
                        <span className="text-sm font-bold">{systemHealth.api_response_time}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('pages.admin.server_uptime')}</span>
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
                    {t('pages.admin.system_alerts_notifications')}
                  </CardTitle>
                  <CardDescription>
                    {t('pages.admin.monitor_system_alerts')}
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
                              <Badge variant="outline">{t('resolved')}</Badge>
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
                            {t('pages.admin.resolve')}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      User Activity & Management
                    </CardTitle>
                    <CardDescription>
                      Monitor user sessions and manage accounts
                    </CardDescription>
                  </div>
                  {/* Column Visibility */}
                  <ColumnVisibilityDropdown
                    columns={USER_MANAGEMENT_COLUMNS}
                    visibleColumns={visibleColumns}
                    onToggleColumn={toggleColumn}
                    onShowAll={showAllColumns}
                    onHideAll={hideAllColumns}
                    onReset={resetColumns}
                    isSyncing={isSyncing}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isColumnVisible('user') && <TableHead>User</TableHead>}
                      {isColumnVisible('role') && <TableHead>Role</TableHead>}
                      {isColumnVisible('status') && <TableHead>Status</TableHead>}
                      {isColumnVisible('session') && <TableHead>Session</TableHead>}
                      {isColumnVisible('actions') && <TableHead>Actions</TableHead>}
                      {isColumnVisible('last_login') && <TableHead>Last Login</TableHead>}
                      <TableHead>Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivity.map((user) => (
                      <TableRow 
                        key={user.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/user-activity/${user.id}`)}
                      >
                        {isColumnVisible('user') && (
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                user.status === 'online' ? 'bg-green-100' : 'bg-gray-100'
                              }`}>
                                <Users className={`h-4 w-4 ${
                                  user.status === 'online' ? 'text-green-600' : 'text-gray-600'
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('role') && (
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                        )}
                        {isColumnVisible('status') && (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={user.status === 'online' ? 'default' : 'secondary'}>
                                {user.status}
                              </Badge>
                              {user.account_status && (
                                <Badge variant={user.account_status === 'active' ? 'outline' : 'destructive'} className="text-xs">
                                  {user.account_status}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('session') && (
                          <TableCell>
                            <p className="text-sm">{user.session_duration}</p>
                          </TableCell>
                        )}
                        {isColumnVisible('actions') && (
                          <TableCell>
                            <p className="text-sm font-medium">{user.actions_count}</p>
                          </TableCell>
                        )}
                        {isColumnVisible('last_login') && (
                          <TableCell>
                            <p className="text-sm">{formatDateTime(user.last_login)}</p>
                          </TableCell>
                        )}
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation() // Prevent row click
                              handleEditUser(user)
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground mt-4">
                  💡 Click on any user row to view their detailed activity history
                </p>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* User Management Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information, role, and password
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('pages.admin.enter_name')}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t('pages.admin.enter_email')}
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value) => setUserFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.admin.select_role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={userFormData.status}
                  onValueChange={(value) => setUserFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="password">New Password (Optional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters required
                </p>
              </div>

              {/* Confirm Password */}
              {userFormData.password && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userFormData.confirmPassword}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsUserDialogOpen(false)}
                disabled={isSavingUser}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={isSavingUser}
              >
                {isSavingUser ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
