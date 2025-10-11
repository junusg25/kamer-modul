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
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

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

// Define columns for Performance table
const PERFORMANCE_COLUMNS = defineColumns([
  { key: 'name', label: 'Sales Person' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'target', label: 'Target' },
  { key: 'achievement', label: 'Achievement' },
  { key: 'leads', label: 'Leads' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'performance', label: 'Performance' },
])

// Define columns for Trends table
const TRENDS_COLUMNS = defineColumns([
  { key: 'period', label: 'Period' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'leads', label: 'Leads' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'deals', label: 'Deals' },
])

// Define columns for Forecast table
const FORECAST_COLUMNS = defineColumns([
  { key: 'month', label: 'Month' },
  { key: 'forecasted', label: 'Forecasted' },
  { key: 'actual', label: 'Actual' },
  { key: 'variance', label: 'Variance' },
  { key: 'confidence', label: 'Confidence' },
])

export default function SalesReports() {
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedReport, setSelectedReport] = useState('overview')

  // Column visibility hooks
  const performanceColumnVisibility = useColumnVisibility('sales_performance', getDefaultColumnKeys(PERFORMANCE_COLUMNS))
  const trendsColumnVisibility = useColumnVisibility('sales_trends', getDefaultColumnKeys(TRENDS_COLUMNS))
  const forecastColumnVisibility = useColumnVisibility('sales_forecast', getDefaultColumnKeys(FORECAST_COLUMNS))

  // Helper function to convert frontend time period to backend format
  const getBackendTimePeriod = (period: string) => {
    switch (period) {
      case '7d': return 'week'
      case '30d': return 'month'
      case '90d': return 'quarter'
      case '1y': return 'year'
      case 'ytd': return 'year'
      default: return 'month'
    }
  }

  // Helper function to convert time period to target type
  const getTargetType = (period: string): 'monthly' | 'quarterly' | 'yearly' => {
    switch (period) {
      case '7d':
      case '30d': return 'monthly'
      case '90d': return 'quarterly'
      case '1y':
      case 'ytd': return 'yearly'
      default: return 'monthly'
    }
  }

  // Fetch sales metrics from API
  const { data: salesMetricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['sales-metrics', selectedPeriod],
    queryFn: () => apiService.getSalesMetrics({ time_period: getBackendTimePeriod(selectedPeriod) }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch sales team data
  const { data: salesTeamData, isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team', selectedPeriod],
    queryFn: () => apiService.getSalesTeam(getTargetType(selectedPeriod)),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch sales trends data
  const { data: salesTrendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['sales-trends', selectedPeriod],
    queryFn: () => apiService.getSalesTrends({ 
      time_period: getBackendTimePeriod(selectedPeriod),
      group_by: 'month' // Always group by month for trends view
    }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch sales forecast data
  const { data: salesForecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['sales-forecast'],
    queryFn: () => apiService.getSalesForecast({ months: 6 }),
    staleTime: 30 * 60 * 1000, // 30 minutes (forecasts don't change as frequently)
  })

  // Fetch recent sales
  const { data: recentSalesData, isLoading: recentSalesLoading } = useQuery({
    queryKey: ['recent-sales', selectedPeriod],
    queryFn: () => apiService.getRecentSales({ limit: 10, time_period: getBackendTimePeriod(selectedPeriod) }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch top customers
  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['top-customers', selectedPeriod],
    queryFn: () => apiService.getTopCustomers({ limit: 10, time_period: getBackendTimePeriod(selectedPeriod) }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch lead sources
  const { data: leadSourcesData, isLoading: leadSourcesLoading } = useQuery({
    queryKey: ['lead-sources', selectedPeriod],
    queryFn: () => apiService.getLeadSources({ time_period: getBackendTimePeriod(selectedPeriod) }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Combined loading state
  const isLoading = metricsLoading || teamLoading || recentSalesLoading || topCustomersLoading || leadSourcesLoading

  // Process sales metrics data
  const salesMetrics: SalesMetrics = salesMetricsData?.data ? {
    totalRevenue: salesMetricsData.data.totalRevenue || 0,
    totalLeads: salesMetricsData.data.totalSales || 0,
    totalQuotes: 0, // Not available in current API
    conversionRate: salesMetricsData.data.totalSales > 0 ? Math.round((salesMetricsData.data.customersServed / salesMetricsData.data.totalSales) * 100) : 0, // Calculate conversion rate
    averageDealSize: salesMetricsData.data.avgSalePrice || 0,
    salesCycle: 0, // Not available in current API
    winRate: salesMetricsData.data.totalSales > 0 ? Math.round((salesMetricsData.data.customersServed / salesMetricsData.data.totalSales) * 100) : 0, // Use same as conversion for now
    monthlyGrowth: salesMetricsData.data.revenueChange || 0 // Use revenue change as growth indicator
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
    conversionRate: member.totalSales > 0 ? Math.round((member.customersServed / member.totalSales) * 100) : 0, // Calculate conversion rate
    averageDealSize: member.avgSalePrice || 0,
    salesCycle: 0, // Not available in current API
    winRate: member.totalSales > 0 ? Math.round((member.customersServed / member.totalSales) * 100) : 0, // Use same as conversion for now
    monthlyTarget: member.target || 0, // This is now dynamic based on target_type parameter
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
    company: customer.company || customer.name,
    totalRevenue: customer.totalRevenue || 0,
    totalDeals: customer.totalDeals || 0,
    lastDeal: customer.lastDeal || new Date().toISOString(),
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

  // Process sales trends data from backend
  const salesTrends: SalesTrend[] = salesTrendsData?.data ? salesTrendsData.data.map((trend: any) => ({
    month: trend.month || new Date(trend.date).toLocaleDateString('en-US', { month: 'short' }),
    revenue: trend.revenue || 0,
    leads: trend.leads || 0,
    quotes: trend.quotes || 0,
    deals: trend.deals || trend.sales || 0
  })) : []


  // Process sales forecast data from backend
  const salesForecast: SalesForecast[] = salesForecastData?.data ? salesForecastData.data.map((forecast: any) => ({
    month: forecast.month,
    forecasted: forecast.forecasted || 0,
    actual: forecast.actual || 0,
    confidence: forecast.confidence || 0
  })) : []

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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales Team Performance</CardTitle>
                    <CardDescription>
                      Individual performance metrics and targets
                    </CardDescription>
                  </div>
                  {/* Column Visibility */}
                  <ColumnVisibilityDropdown
                    columns={PERFORMANCE_COLUMNS}
                    visibleColumns={performanceColumnVisibility.visibleColumns}
                    onToggleColumn={performanceColumnVisibility.toggleColumn}
                    onShowAll={performanceColumnVisibility.showAllColumns}
                    onHideAll={performanceColumnVisibility.hideAllColumns}
                    onReset={performanceColumnVisibility.resetColumns}
                    isSyncing={performanceColumnVisibility.isSyncing}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {performanceColumnVisibility.isColumnVisible('name') && <TableHead>Salesperson</TableHead>}
                      {performanceColumnVisibility.isColumnVisible('revenue') && <TableHead>Revenue</TableHead>}
                      {performanceColumnVisibility.isColumnVisible('target') && <TableHead>Target</TableHead>}
                      {performanceColumnVisibility.isColumnVisible('leads') && <TableHead>Leads</TableHead>}
                      {performanceColumnVisibility.isColumnVisible('conversion') && <TableHead>Conversion</TableHead>}
                      {performanceColumnVisibility.isColumnVisible('performance') && <TableHead>Performance</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTeam.map((person) => (
                      <TableRow key={person.id}>
                        {performanceColumnVisibility.isColumnVisible('name') && (
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
                        )}
                        {performanceColumnVisibility.isColumnVisible('revenue') && (
                          <TableCell className="font-medium">
                            {formatCurrency(person.totalRevenue)}
                          </TableCell>
                        )}
                        {performanceColumnVisibility.isColumnVisible('target') && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress 
                                value={person.monthlyTarget > 0 ? (person.monthlyActual / person.monthlyTarget) * 100 : 0} 
                                className="w-16" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {person.monthlyTarget > 0 ? formatPercentage((person.monthlyActual / person.monthlyTarget) * 100) : '0%'}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {performanceColumnVisibility.isColumnVisible('leads') && (
                          <TableCell>{person.totalLeads}</TableCell>
                        )}
                        {performanceColumnVisibility.isColumnVisible('conversion') && (
                          <TableCell>{formatPercentage(person.conversionRate)}</TableCell>
                        )}
                        {performanceColumnVisibility.isColumnVisible('performance') && (
                          <TableCell>
                            <Badge className={getPerformanceColor(person.performance)}>
                              {person.performance.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        )}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales Trends</CardTitle>
                    <CardDescription>
                      Monthly revenue and activity trends
                    </CardDescription>
                  </div>
                  {/* Column Visibility */}
                  <ColumnVisibilityDropdown
                    columns={TRENDS_COLUMNS}
                    visibleColumns={trendsColumnVisibility.visibleColumns}
                    onToggleColumn={trendsColumnVisibility.toggleColumn}
                    onShowAll={trendsColumnVisibility.showAllColumns}
                    onHideAll={trendsColumnVisibility.hideAllColumns}
                    onReset={trendsColumnVisibility.resetColumns}
                    isSyncing={trendsColumnVisibility.isSyncing}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading trends data...</div>
                  </div>
                ) : salesTrends.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">No trends data available for the selected period.</div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {trendsColumnVisibility.isColumnVisible('period') && <TableHead>Month</TableHead>}
                        {trendsColumnVisibility.isColumnVisible('revenue') && <TableHead>Revenue</TableHead>}
                        {trendsColumnVisibility.isColumnVisible('leads') && <TableHead>Leads</TableHead>}
                        {trendsColumnVisibility.isColumnVisible('quotes') && <TableHead>Quotes</TableHead>}
                        {trendsColumnVisibility.isColumnVisible('deals') && <TableHead>Deals</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesTrends.map((trend, index) => {
                        const previousRevenue = index > 0 ? salesTrends[index - 1].revenue : trend.revenue
                        const growth = previousRevenue > 0 ? ((trend.revenue - previousRevenue) / previousRevenue) * 100 : 0
                        
                        return (
                          <TableRow key={trend.month}>
                            {trendsColumnVisibility.isColumnVisible('period') && (
                              <TableCell className="font-medium">{trend.month}</TableCell>
                            )}
                            {trendsColumnVisibility.isColumnVisible('revenue') && (
                              <TableCell>{formatCurrency(trend.revenue)}</TableCell>
                            )}
                            {trendsColumnVisibility.isColumnVisible('leads') && (
                              <TableCell>{trend.leads}</TableCell>
                            )}
                            {trendsColumnVisibility.isColumnVisible('quotes') && (
                              <TableCell>{trend.quotes}</TableCell>
                            )}
                            {trendsColumnVisibility.isColumnVisible('deals') && (
                              <TableCell>{trend.deals}</TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            {/* Sales Forecast */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales Forecast</CardTitle>
                    <CardDescription>
                      Revenue forecast and confidence levels based on historical data
                    </CardDescription>
                  </div>
                  {/* Column Visibility */}
                  <ColumnVisibilityDropdown
                    columns={FORECAST_COLUMNS}
                    visibleColumns={forecastColumnVisibility.visibleColumns}
                    onToggleColumn={forecastColumnVisibility.toggleColumn}
                    onShowAll={forecastColumnVisibility.showAllColumns}
                    onHideAll={forecastColumnVisibility.hideAllColumns}
                    onReset={forecastColumnVisibility.resetColumns}
                    isSyncing={forecastColumnVisibility.isSyncing}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading forecast data...</div>
                  </div>
                ) : salesForecast.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">No forecast data available. Need more historical data to generate forecasts.</div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {forecastColumnVisibility.isColumnVisible('month') && <TableHead>Month</TableHead>}
                        {forecastColumnVisibility.isColumnVisible('forecasted') && <TableHead>Forecasted</TableHead>}
                        {forecastColumnVisibility.isColumnVisible('actual') && <TableHead>Actual</TableHead>}
                        {forecastColumnVisibility.isColumnVisible('variance') && <TableHead>Variance</TableHead>}
                        {forecastColumnVisibility.isColumnVisible('confidence') && <TableHead>Confidence</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesForecast.map((forecast) => {
                        const variance = forecast.actual > 0 
                          ? ((forecast.actual - forecast.forecasted) / forecast.forecasted) * 100 
                          : 0
                        
                        return (
                          <TableRow key={forecast.month}>
                            {forecastColumnVisibility.isColumnVisible('month') && (
                              <TableCell className="font-medium">{forecast.month}</TableCell>
                            )}
                            {forecastColumnVisibility.isColumnVisible('forecasted') && (
                              <TableCell>{formatCurrency(forecast.forecasted)}</TableCell>
                            )}
                            {forecastColumnVisibility.isColumnVisible('actual') && (
                              <TableCell>
                                {forecast.actual > 0 ? formatCurrency(forecast.actual) : '-'}
                              </TableCell>
                            )}
                            {forecastColumnVisibility.isColumnVisible('variance') && (
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
                            )}
                            {forecastColumnVisibility.isColumnVisible('confidence') && (
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Progress value={forecast.confidence} className="w-16" />
                                  <span className="text-sm text-muted-foreground">
                                    {forecast.confidence}%
                                  </span>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
