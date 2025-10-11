import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { 
  Users, 
  Wrench, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Target, 
  FileText, 
  Briefcase,
  RefreshCw,
  Package,
  UserCheck,
  ArrowRight,
  Activity,
  Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatDateTime } from '@/lib/dateTime'
import apiService from '@/services/api'

// Interfaces
interface OverviewMetrics {
  active_work_orders: number
  pending_work_orders: number
  pending_tickets: number
  completed_this_month: number
  team_utilization: number
  active_technicians: number
  total_technicians: number
}

interface TeamMember {
  id: string
  name: string
  email: string
  account_status: string
  last_login: string
  active_work_orders: number
  pending_work_orders: number
  completed_this_month: number
  avg_completion_hours: string
  workload_status: string
}

interface PriorityWorkOrder {
  id: string
  formatted_number: string
  description: string
  status: string
  priority: string
  created_at: string
  customer_name: string
  technician_name?: string
  technician_id?: string
}

interface RecentActivity {
  entity_type: string
  entity_id: string
  entity_name: string
  status: string
  timestamp: string
  user_name: string
  action: string
}

interface SalesOverview {
  monthly_sales_revenue: number
  monthly_sales_count: number
  active_leads: number
  won_leads_month: number
  new_leads_month: number
  pending_quotes: number
  accepted_quotes_month: number
  conversion_rate: number
}

interface SalesTeamMember {
  id: string
  name: string
  email: string
  total_leads: number
  won_leads: number
  total_quotes: number
  accepted_quotes: number
  deals_closed: number
  revenue: number
  target: number
  target_progress: number
  conversion_rate: number
}

interface InventoryAlert {
  id: string
  name: string
  quantity: number
  min_stock_level: number
  unit_price: number
  category: string
  quantity_needed: number
  reorder_value: number
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('team')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  
  // Time period filter state
  const [timePeriod, setTimePeriod] = useState('month')
  const [customDateRange, setCustomDateRange] = useState<{
    from: string
    to: string
  }>({
    from: '',
    to: ''
  })
  const [useCustomRange, setUseCustomRange] = useState(false)

  // Overview data
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null)
  
  // Team data
  const [teamWorkload, setTeamWorkload] = useState<TeamMember[]>([])
  const [priorityWorkOrders, setPriorityWorkOrders] = useState<PriorityWorkOrder[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  
  // Sales data
  const [salesOverview, setSalesOverview] = useState<SalesOverview | null>(null)
  const [salesTeam, setSalesTeam] = useState<SalesTeamMember[]>([])
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([])

  useEffect(() => {
    fetchAllData()
  }, [timePeriod, customDateRange, useCustomRange])

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchOverviewData(),
        fetchTeamData(),
        fetchSalesData()
      ])
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching manager dashboard data:', error)
    }
  }

  const fetchOverviewData = async () => {
    try {
      const params = useCustomRange && customDateRange.from && customDateRange.to
        ? { time_period: 'custom', start_date: customDateRange.from, end_date: customDateRange.to }
        : { time_period: timePeriod }
      
      const response = await apiService.getManagerOverview(params)
      setOverviewMetrics(response.data)
    } catch (error) {
      console.error('Error fetching overview data:', error)
    }
  }

  const fetchTeamData = async () => {
    try {
      const params = useCustomRange && customDateRange.from && customDateRange.to
        ? { time_period: 'custom', start_date: customDateRange.from, end_date: customDateRange.to }
        : { time_period: timePeriod }
      
      const [teamResponse, priorityResponse, activityResponse] = await Promise.all([
        apiService.getManagerTeamWorkload(params),
        apiService.getManagerPriorityWorkOrders(),
        apiService.getManagerRecentActivity()
      ])
      
      setTeamWorkload(teamResponse.data)
      setPriorityWorkOrders(priorityResponse.data)
      setRecentActivity(activityResponse.data)
    } catch (error) {
      console.error('Error fetching team data:', error)
    }
  }

  const fetchSalesData = async () => {
    try {
      const params = useCustomRange && customDateRange.from && customDateRange.to
        ? { time_period: 'custom', start_date: customDateRange.from, end_date: customDateRange.to }
        : { time_period: timePeriod }
      
      const [salesResponse, teamResponse, alertsResponse] = await Promise.all([
        apiService.getManagerSalesOverview(params),
        apiService.getManagerSalesTeam(params),
        apiService.getManagerInventoryAlerts()
      ])
      
      setSalesOverview(salesResponse.data)
      setSalesTeam(teamResponse.data)
      setInventoryAlerts(alertsResponse.data)
    } catch (error) {
      console.error('Error fetching sales data:', error)
    }
  }

  const handleRefresh = () => {
    fetchAllData()
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    
    // Fetch tab-specific data if needed
    if (value === 'team' && teamWorkload.length === 0) {
      fetchTeamData()
    } else if (value === 'sales' && salesOverview === null) {
      fetchSalesData()
    }
  }

  const getPeriodLabel = () => {
    if (useCustomRange && customDateRange.from && customDateRange.to) {
      return 'Selected Period'
    }
    switch (timePeriod) {
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
      case 'quarter':
        return 'This Quarter'
      case 'year':
        return 'This Year'
      default:
        return 'This Month'
    }
  }

  const getWorkloadColor = (status: string) => {
    switch (status) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400'
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', text: string }> = {
      'pending': { variant: 'secondary', text: 'Pending' },
      'in_progress': { variant: 'default', text: 'In Progress' },
      'completed': { variant: 'outline', text: 'Completed' },
      'on_hold': { variant: 'secondary', text: 'On Hold' },
      'cancelled': { variant: 'destructive', text: 'Cancelled' }
    }
    
    const config = statusMap[status] || { variant: 'secondary' as const, text: status }
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { className: string, text: string }> = {
      'low': { className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', text: 'Low' },
      'medium': { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400', text: 'Medium' },
      'high': { className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400', text: 'High' },
      'urgent': { className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400', text: 'Urgent' }
    }
    
    const config = priorityMap[priority] || { className: 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400', text: priority }
    return <Badge className={config.className}>{config.text}</Badge>
  }

  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Manager Dashboard</h2>
            <p className="text-muted-foreground">
              Overview of team performance, operations, and sales metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Period Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Metrics Period:</span>
              <Select
                value={useCustomRange ? 'custom' : timePeriod}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setUseCustomRange(true)
                  } else {
                    setUseCustomRange(false)
                    setTimePeriod(value)
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Custom Date Range (appears below when selected) */}
        {useCustomRange && (
          <div className="flex items-center gap-2 justify-end">
            <DatePicker
              value={customDateRange.from}
              onChange={(value) => setCustomDateRange(prev => ({ ...prev, from: value }))}
              placeholder="From date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker
              value={customDateRange.to}
              onChange={(value) => setCustomDateRange(prev => ({ ...prev, to: value }))}
              placeholder="To date"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomDateRange({ from: '', to: '' })
                setUseCustomRange(false)
                setTimePeriod('month')
              }}
            >
              Clear
            </Button>
          </div>
        )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Overview
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Sales & Revenue
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Team Overview */}
        <TabsContent value="team" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewMetrics?.active_work_orders || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overviewMetrics?.pending_work_orders || 0} pending (includes warranty)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Tickets</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewMetrics?.pending_tickets || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting conversion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed {getPeriodLabel()}</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewMetrics?.completed_this_month || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Work orders & tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Utilization</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewMetrics?.team_utilization || 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overviewMetrics?.active_technicians || 0} of {overviewMetrics?.total_technicians || 0} active
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Team Workload Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Team Workload Distribution</CardTitle>
              <CardDescription>Current workload and performance for each technician</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Completed ({timePeriod === 'week' ? 'Week' : timePeriod === 'quarter' ? 'Quarter' : timePeriod === 'year' ? 'Year' : useCustomRange ? 'Period' : 'Month'})</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead className="text-center">Workload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamWorkload.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No technicians found
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamWorkload.map((tech) => (
                      <TableRow key={tech.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tech.name}</p>
                            <p className="text-sm text-muted-foreground">{tech.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
                            {tech.active_work_orders}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{tech.pending_work_orders}</TableCell>
                        <TableCell className="text-center">{tech.completed_this_month}</TableCell>
                        <TableCell className="text-right">{tech.avg_completion_hours}h</TableCell>
                        <TableCell className="text-center">
                          <Badge className={getWorkloadColor(tech.workload_status)}>
                            {tech.workload_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Priority Work Orders & Recent Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Priority Work Orders
                </CardTitle>
                <CardDescription>High priority items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {priorityWorkOrders.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No priority work orders
                    </div>
                  ) : (
                    priorityWorkOrders.slice(0, 5).map((workOrder) => (
                      <div key={workOrder.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{workOrder.formatted_number}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {workOrder.description || 'No description'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {workOrder.customer_name} • {workOrder.technician_name || 'Unassigned'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {getPriorityBadge(workOrder.priority)}
                          {getStatusBadge(workOrder.status)}
                        </div>
                      </div>
                    ))
                  )}
                  {priorityWorkOrders.length > 5 && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate('/work-orders?priority=high')}
                    >
                      View All Priority Orders
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest updates across the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No recent activity
                    </div>
                  ) : (
                    recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {activity.user_name} {activity.action} {activity.entity_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(activity.timestamp)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.entity_type}
                        </Badge>
                      </div>
                    ))
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/admin/action-logs')}
                  >
                    View All Activity
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Sales & Revenue */}
        <TabsContent value="sales" className="space-y-6">
          {/* Sales Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue ({getPeriodLabel()})</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesOverview?.monthly_sales_revenue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesOverview?.monthly_sales_count || 0} sales
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesOverview?.active_leads || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesOverview?.new_leads_month || 0} new this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(salesOverview?.conversion_rate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesOverview?.won_leads_month || 0} won {timePeriod === 'week' ? 'this week' : timePeriod === 'quarter' ? 'this quarter' : timePeriod === 'year' ? 'this year' : useCustomRange ? 'in period' : 'this month'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesOverview?.pending_quotes || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesOverview?.accepted_quotes_month || 0} accepted this month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Team Performance</CardTitle>
              <CardDescription>Individual performance and target progress</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sales Person</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Quotes</TableHead>
                    <TableHead className="text-center">Deals</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-center">Conv. Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesTeam.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No sales team data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesTeam.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{member.total_leads}</TableCell>
                        <TableCell className="text-center">{member.total_quotes}</TableCell>
                        <TableCell className="text-center">{member.deals_closed}</TableCell>
                        <TableCell className="text-right">{formatCurrency(member.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(member.target)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={member.target_progress} className="h-2" />
                            <p className="text-xs text-muted-foreground">{member.target_progress.toFixed(1)}%</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{member.conversion_rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Inventory Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                Inventory Alerts
              </CardTitle>
              <CardDescription>Items requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inventoryAlerts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No inventory alerts
                  </div>
                ) : (
                  inventoryAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{alert.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.category} • {alert.quantity} in stock • Min: {alert.min_stock_level}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Need {alert.quantity_needed} units • Reorder value: {formatCurrency(alert.reorder_value)}
                        </p>
                      </div>
                      <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
                        {alert.quantity < alert.min_stock_level ? 'Low Stock' : 'Out of Stock'}
                      </Badge>
                    </div>
                  ))
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/inventory?stock_status=low')}
                >
                  View All Inventory Alerts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  )
}
