import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { apiService } from '../services/api'
import { formatCurrency } from '../lib/currency'
import { formatDate } from '../lib/dateTime'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Truck, 
  Calendar,
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface AnalyticsData {
  fleet: any
  revenue: any
  utilization: any
  customers: any
  status: any[]
  overdue: any
  dateRange: string
  generatedAt: string
}

interface RealTimeData {
  current_rentals: any[]
  today_stats: any
  alerts: any[]
  last_updated: string
}

export default function RentalAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [realTimeData, setRealTimeData] = useState<RealTimeData | null>(null)
  const [dateRange, setDateRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalyticsData()
    fetchRealTimeData()
  }, [dateRange])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const data = await apiService.getRentalAnalyticsOverview(dateRange)
      setAnalyticsData(data)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const fetchRealTimeData = async () => {
    try {
      const data = await apiService.getRentalRealTimeDashboard()
      setRealTimeData(data)
    } catch (error) {
      console.error('Error fetching real-time data:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      rented: 'bg-blue-100 text-blue-800',
      reserved: 'bg-yellow-100 text-yellow-800',
      cleaning: 'bg-orange-100 text-orange-800',
      inspection: 'bg-purple-100 text-purple-800',
      maintenance: 'bg-red-100 text-red-800',
      repair: 'bg-red-100 text-red-800',
      quarantine: 'bg-gray-100 text-gray-800',
      retired: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info': return <Activity className="h-4 w-4 text-blue-500" />
      default: return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAnalyticsData}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rental Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive insights into your rental business</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchAnalyticsData} variant="outline">
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {realTimeData?.alerts && realTimeData.alerts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">System Alerts</h3>
            <div className="grid gap-3">
              {realTimeData.alerts.map((alert, index) => (
                <div key={index} className="flex items-center p-3 bg-white border rounded-lg">
                  {getAlertIcon(alert.type)}
                  <div className="ml-3">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fleet">Fleet</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="realtime">Real-time</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analyticsData?.revenue?.total_revenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsData?.revenue?.total_rentals || 0} total rentals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData?.fleet?.utilization_percentage || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsData?.fleet?.rented_machines || 0} of {analyticsData?.fleet?.total_machines || 0} machines
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsData?.customers?.unique_customers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsData?.customers?.total_rentals || 0} total rentals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Rentals</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {analyticsData?.overdue?.overdue_count || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(analyticsData?.overdue?.overdue_value || 0)} at risk
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Fleet Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Fleet Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {analyticsData?.status?.map((status) => (
                    <div key={status.rental_status} className="text-center">
                      <div className="text-2xl font-bold">{status.count}</div>
                      <div className="text-sm text-gray-600 capitalize">{status.rental_status}</div>
                      <div className="text-xs text-gray-500">{status.percentage}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Rentals</TableHead>
                      <TableHead>Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData?.customers?.top_customers?.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.company_name && (
                              <div className="text-sm text-gray-500">{customer.company_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{customer.rental_count}</TableCell>
                        <TableCell>{formatCurrency(customer.total_spent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fleet Tab */}
          <TabsContent value="fleet" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fleet Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Machines</span>
                    <span className="font-semibold">{analyticsData?.fleet?.total_machines || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available</span>
                    <span className="font-semibold text-green-600">{analyticsData?.fleet?.available_machines || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rented</span>
                    <span className="font-semibold text-blue-600">{analyticsData?.fleet?.rented_machines || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reserved</span>
                    <span className="font-semibold text-yellow-600">{analyticsData?.fleet?.reserved_machines || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maintenance</span>
                    <span className="font-semibold text-red-600">{analyticsData?.fleet?.maintenance_machines || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.status?.map((status) => (
                      <div key={status.rental_status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(status.rental_status).split(' ')[0]}`}></div>
                          <span className="text-sm capitalize">{status.rental_status}</span>
                        </div>
                        <div className="text-sm font-medium">{status.count}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Utilization Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Utilization Rate</span>
                    <span className="font-semibold">{analyticsData?.fleet?.utilization_percentage || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Daily Rentals</span>
                    <span className="font-semibold">{analyticsData?.utilization?.average_daily_rentals || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peak Daily Rentals</span>
                    <span className="font-semibold">{analyticsData?.utilization?.peak_daily_rentals || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Revenue</span>
                    <span className="font-semibold">{formatCurrency(analyticsData?.revenue?.total_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Revenue</span>
                    <span className="font-semibold text-green-600">{formatCurrency(analyticsData?.revenue?.active_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Revenue</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(analyticsData?.revenue?.completed_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue Revenue</span>
                    <span className="font-semibold text-red-600">{formatCurrency(analyticsData?.revenue?.overdue_revenue || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rental Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Rentals</span>
                    <span className="font-semibold">{analyticsData?.revenue?.total_rentals || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Rental Value</span>
                    <span className="font-semibold">{formatCurrency(analyticsData?.revenue?.average_rental_value || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Unique Customers</span>
                    <span className="font-semibold">{analyticsData?.customers?.unique_customers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Rentals</span>
                    <span className="font-semibold">{analyticsData?.customers?.total_rentals || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Rentals per Customer</span>
                    <span className="font-semibold">{analyticsData?.customers?.average_rentals_per_customer || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Rentals per Customer</span>
                    <span className="font-semibold">{analyticsData?.customers?.max_rentals_per_customer || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData?.customers?.top_customers?.slice(0, 5).map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.company_name && (
                            <div className="text-sm text-gray-500">{customer.company_name}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(customer.total_spent)}</div>
                          <div className="text-sm text-gray-500">{customer.rental_count} rentals</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="realtime" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Rentals</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{realTimeData?.today_stats?.new_rentals_today || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(realTimeData?.today_stats?.revenue_today || 0)} revenue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Starting Today</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{realTimeData?.today_stats?.rentals_starting_today || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ending Today</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{realTimeData?.today_stats?.rentals_ending_today || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {realTimeData?.last_updated ? formatDate(realTimeData.last_updated) : 'Never'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current Rentals */}
            <Card>
              <CardHeader>
                <CardTitle>Current Active Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Machine</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Return Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {realTimeData?.current_rentals?.map((rental) => (
                      <TableRow key={rental.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rental.customer_name}</div>
                            {rental.company_name && (
                              <div className="text-sm text-gray-500">{rental.company_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rental.manufacturer} {rental.machine_name}</div>
                            <div className="text-sm text-gray-500">{rental.serial_number}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(rental.rental_start_date)}</TableCell>
                        <TableCell>{formatDate(rental.planned_return_date)}</TableCell>
                        <TableCell>{formatCurrency(rental.total_amount)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={rental.status === 'overdue' ? 'destructive' : 
                                   rental.status === 'ending_soon' ? 'secondary' : 'default'}
                          >
                            {rental.status === 'overdue' ? 'Overdue' :
                             rental.status === 'ending_soon' ? 'Ending Soon' : 'Active'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
