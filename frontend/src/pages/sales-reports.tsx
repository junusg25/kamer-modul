import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Progress } from '../components/ui/progress'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  Target, 
  Calendar,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Building2,
  FileText,
  Phone,
  Mail
} from 'lucide-react'
import { useAuth } from '../contexts/auth-context'

interface SalesMetrics {
  totalRevenue: number
  totalLeads: number
  totalQuotes: number
  conversionRate: number
  averageDealSize: number
  salesCycle: number
  winRate: number
  monthlyGrowth: number
}

interface SalesPerson {
  id: number
  name: string
  email: string
  avatar?: string
  totalRevenue: number
  totalLeads: number
  totalQuotes: number
  conversionRate: number
  averageDealSize: number
  salesCycle: number
  winRate: number
  monthlyTarget: number
  monthlyActual: number
  performance: 'excellent' | 'good' | 'average' | 'needs_improvement'
}

interface LeadSource {
  source: string
  leads: number
  revenue: number
  conversionRate: number
  percentage: number
}

interface SalesTrend {
  month: string
  revenue: number
  leads: number
  quotes: number
  deals: number
}

interface TopCustomer {
  id: number
  name: string
  company: string
  totalRevenue: number
  totalDeals: number
  lastDeal: string
  status: 'active' | 'inactive' | 'prospect'
}

interface SalesForecast {
  month: string
  forecasted: number
  actual: number
  confidence: number
}

const TIME_PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'ytd', label: 'Year to Date' }
]

const REPORT_TYPES = [
  { value: 'overview', label: 'Overview' },
  { value: 'performance', label: 'Performance' },
  { value: 'trends', label: 'Trends' },
  { value: 'forecast', label: 'Forecast' }
]

export default function SalesReports() {
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedReport, setSelectedReport] = useState('overview')

  // Fetch sales metrics from API
  const { data: salesMetricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['sales-metrics', selectedPeriod],
    queryFn: () => apiService.getSalesMetrics({ time_period: selectedPeriod }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch sales team data
  const { data: salesTeamData, isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team'],
    queryFn: () => apiService.getSalesTeam(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch recent sales
  const { data: recentSalesData, isLoading: recentSalesLoading } = useQuery({
    queryKey: ['recent-sales', selectedPeriod],
    queryFn: () => apiService.getRecentSales({ limit: 10 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch top customers
  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['top-customers', selectedPeriod],
    queryFn: () => apiService.getTopCustomers({ limit: 10, time_period: selectedPeriod }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch lead sources
  const { data: leadSourcesData, isLoading: leadSourcesLoading } = useQuery({
    queryKey: ['lead-sources', selectedPeriod],
    queryFn: () => apiService.getLeadSources({ time_period: selectedPeriod }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Combined loading state
  const isLoading = metricsLoading || teamLoading || recentSalesLoading || topCustomersLoading || leadSourcesLoading

  // Process sales metrics data
  const salesMetrics: SalesMetrics = salesMetricsData?.data ? {
    totalRevenue: salesMetricsData.data.total_revenue || 0,
    totalLeads: salesMetricsData.data.total_sales || 0,
    totalQuotes: 0, // Not available in current API
    conversionRate: 0, // Not available in current API
    averageDealSize: salesMetricsData.data.avg_sale_price || 0,
    salesCycle: 0, // Not available in current API
    winRate: 0, // Not available in current API
    monthlyGrowth: 0 // Not available in current API
  } : {
    totalRevenue: 0,
    totalLeads: 0,
    totalQuotes: 0,
    conversionRate: 0,
    averageDealSize: 0,
    salesCycle: 0,
    winRate: 0,
    monthlyGrowth: 0
  }

  // Process sales team data
  const salesTeam: SalesPerson[] = salesTeamData?.data?.team ? salesTeamData.data.team.map((member: any) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    avatar: member.avatar,
    totalRevenue: member.totalRevenue || 0,
    totalLeads: member.totalSales || 0,
    totalQuotes: 0, // Not available in current API
    conversionRate: 0, // Not available in current API
    averageDealSize: member.avgSalePrice || 0,
    salesCycle: 0, // Not available in current API
    winRate: 0, // Not available in current API
    monthlyTarget: member.target || 0,
    monthlyActual: member.totalRevenue || 0,
    performance: member.completionRate >= 100 ? 'excellent' : 
                 member.completionRate >= 80 ? 'good' : 
                 member.completionRate >= 60 ? 'average' : 'needs_improvement'
  })) : []

  // Process recent sales data
  const recentSales: RecentSale[] = recentSalesData?.data?.sales ? recentSalesData.data.sales.map((sale: any) => ({
    id: sale.id,
    customer_name: sale.customer_name || 'Unknown Customer',
    company_name: sale.company_name,
    model_name: sale.model_name || 'Unknown Model',
    serial_number: sale.serial_number || 'N/A',
    sold_by_name: sale.sold_by_name || 'Unknown',
    sale_price: sale.sale_price || 0,
    sale_date: sale.sale_date || new Date().toISOString()
  })) : []

  // Process top customers data
  const topCustomers: TopCustomer[] = topCustomersData?.data?.customers ? topCustomersData.data.customers.map((customer: any) => ({
    id: customer.id,
    name: customer.name || 'Unknown Customer',
    company: customer.company_name || customer.name,
    totalRevenue: customer.total_revenue || 0,
    totalDeals: customer.total_deals || 0,
    lastDeal: customer.last_deal || new Date().toISOString(),
    status: customer.status || 'active'
  })) : []

  // Process lead sources data
  const leadSources: LeadSource[] = leadSourcesData?.data?.leadSources ? leadSourcesData.data.leadSources.map((source: any) => ({
    source: source.source,
    leads: source.leads || 0,
    revenue: source.revenue || 0,
    conversionRate: source.conversionRate || 0,
    percentage: source.percentage || 0
  })) : []

  // Check if we have any lead sources data
  const hasLeadSourcesData = leadSources.length > 0

  const salesTrends: SalesTrend[] = [
    { month: 'Jan', revenue: 45000, leads: 12, quotes: 8, deals: 5 },
    { month: 'Feb', revenue: 52000, leads: 15, quotes: 10, deals: 6 },
    { month: 'Mar', revenue: 48000, leads: 14, quotes: 9, deals: 5 },
    { month: 'Apr', revenue: 61000, leads: 18, quotes: 12, deals: 7 },
    { month: 'May', revenue: 55000, leads: 16, quotes: 11, deals: 6 },
    { month: 'Jun', revenue: 68000, leads: 20, quotes: 14, deals: 8 },
    { month: 'Jul', revenue: 72000, leads: 22, quotes: 15, deals: 9 },
    { month: 'Aug', revenue: 65000, leads: 19, quotes: 13, deals: 7 },
    { month: 'Sep', revenue: 58000, leads: 17, quotes: 12, deals: 6 },
    { month: 'Oct', revenue: 62000, leads: 18, quotes: 13, deals: 7 },
    { month: 'Nov', revenue: 59000, leads: 16, quotes: 11, deals: 6 },
    { month: 'Dec', revenue: 71000, leads: 21, quotes: 14, deals: 8 }
  ]


  const salesForecast: SalesForecast[] = [
    { month: 'Jan 2025', forecasted: 75000, actual: 72000, confidence: 85 },
    { month: 'Feb 2025', forecasted: 82000, actual: 0, confidence: 78 },
    { month: 'Mar 2025', forecasted: 78000, actual: 0, confidence: 72 },
    { month: 'Apr 2025', forecasted: 85000, actual: 0, confidence: 68 },
    { month: 'May 2025', forecasted: 90000, actual: 0, confidence: 65 },
    { month: 'Jun 2025', forecasted: 95000, actual: 0, confidence: 62 }
  ]

  // formatCurrency is now imported from lib/currency

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  // Date formatting functions are now imported from lib/dateTime

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'average': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'needs_improvement': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      case 'prospect': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const handleRefresh = () => {
    // Refresh all queries
    window.location.reload()
  }

  const handleExport = () => {
    // Here you would implement export functionality
    console.log('Exporting sales report...')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Reports</h1>
            <p className="text-muted-foreground">
              Comprehensive sales analytics and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(salesMetrics.totalRevenue)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                <span className="text-green-600">+{formatPercentage(salesMetrics.monthlyGrowth)}</span>
                <span className="ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesMetrics.totalLeads}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Target className="h-3 w-3 mr-1" />
                <span>{salesMetrics.totalQuotes} quotes generated</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(salesMetrics.conversionRate)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 mr-1" />
                <span>{formatPercentage(salesMetrics.winRate)} win rate</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Deal Size</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(salesMetrics.averageDealSize)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                <span>{salesMetrics.salesCycle} days avg cycle</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs value={selectedReport} onValueChange={setSelectedReport}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Lead Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Lead Sources</CardTitle>
                  <CardDescription>
                    Revenue breakdown by lead source
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasLeadSourcesData ? (
                    <div className="space-y-4">
                      {leadSources.map((source, index) => (
                        <div key={source.source} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{source.source}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(source.revenue)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Progress value={source.percentage} className="flex-1" />
                            <span className="text-xs text-muted-foreground w-12">
                              {formatPercentage(source.percentage)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{source.leads} leads</span>
                            <span>{formatPercentage(source.conversionRate)} conversion</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-2">No lead sources data available</div>
                        <div className="text-xs text-muted-foreground">
                          Lead sources will appear here once leads are created in the system
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Customers */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Customers</CardTitle>
                  <CardDescription>
                    Highest revenue generating customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topCustomers.map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {customer.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">{customer.company}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">{formatCurrency(customer.totalRevenue)}</div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(customer.status)}>
                              {customer.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {customer.totalDeals} deals
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {/* Sales Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Team Performance</CardTitle>
                <CardDescription>
                  Individual performance metrics and targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Conversion</TableHead>
                      <TableHead>Deal Size</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTeam.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {person.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{person.name}</div>
                              <div className="text-sm text-muted-foreground">{person.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(person.totalRevenue)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{formatCurrency(person.monthlyTarget)}</div>
                            <div className="flex items-center space-x-2">
                              <Progress 
                                value={(person.monthlyActual / person.monthlyTarget) * 100} 
                                className="w-16" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {formatPercentage((person.monthlyActual / person.monthlyTarget) * 100)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{person.totalLeads}</TableCell>
                        <TableCell>{formatPercentage(person.conversionRate)}</TableCell>
                        <TableCell>{formatCurrency(person.averageDealSize)}</TableCell>
                        <TableCell>
                          <Badge className={getPerformanceColor(person.performance)}>
                            {person.performance.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            {/* Sales Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Trends</CardTitle>
                <CardDescription>
                  Monthly revenue and activity trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Quotes</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTrends.map((trend, index) => {
                      const previousRevenue = index > 0 ? salesTrends[index - 1].revenue : trend.revenue
                      const growth = ((trend.revenue - previousRevenue) / previousRevenue) * 100
                      
                      return (
                        <TableRow key={trend.month}>
                          <TableCell className="font-medium">{trend.month}</TableCell>
                          <TableCell>{formatCurrency(trend.revenue)}</TableCell>
                          <TableCell>{trend.leads}</TableCell>
                          <TableCell>{trend.quotes}</TableCell>
                          <TableCell>{trend.deals}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {growth >= 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <span className={`text-sm ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPercentage(Math.abs(growth))}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            {/* Sales Forecast */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Forecast</CardTitle>
                <CardDescription>
                  Revenue forecast and confidence levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Forecasted</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesForecast.map((forecast) => {
                      const variance = forecast.actual > 0 
                        ? ((forecast.actual - forecast.forecasted) / forecast.forecasted) * 100 
                        : 0
                      
                      return (
                        <TableRow key={forecast.month}>
                          <TableCell className="font-medium">{forecast.month}</TableCell>
                          <TableCell>{formatCurrency(forecast.forecasted)}</TableCell>
                          <TableCell>
                            {forecast.actual > 0 ? formatCurrency(forecast.actual) : '-'}
                          </TableCell>
                          <TableCell>
                            {forecast.actual > 0 && (
                              <div className="flex items-center space-x-1">
                                {variance >= 0 ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <span className={`text-sm ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatPercentage(Math.abs(variance))}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={forecast.confidence} className="w-16" />
                              <span className="text-sm text-muted-foreground">
                                {forecast.confidence}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
