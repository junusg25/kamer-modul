import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar as CalendarComponent } from '../components/ui/calendar'
import { DatePicker } from '../components/ui/date-picker'
import { Label } from '../components/ui/label'
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../components/ui/chart'
import { 
  Wrench, 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Target,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Award,
  Star,
  Building2,
  FileText,
  Phone,
  Mail,
  Calendar,
  Download,
  Eye,
  Shield,
  Settings,
  Package,
  AlertCircle,
  TrendingDown,
  Zap,
  Globe,
  Database,
  Layers,
  Filter,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Timer,
  UserCheck,
  UserX,
  ShoppingCart,
  CreditCard,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from 'lucide-react'
import { apiService } from '../services/api'
import { format } from 'date-fns'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime, formatDateMedium, isOverdue } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'

const DashboardOverview = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [timeFilter, setTimeFilter] = useState('month') // For metrics cards only
  const [activeTab, setActiveTab] = useState('overview')
  const [chartTimeFilter, setChartTimeFilter] = useState('month') // For chart only
  const [customDateRange, setCustomDateRange] = useState<{
    from: string
    to: string
  }>({
    from: '',
    to: ''
  })
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('revenue')

  // Fetch comprehensive data for overview dashboard
  const { data: repairsData, isLoading: repairsLoading, refetch: refetchRepairs } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
  })

  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['sales-metrics', timeFilter],
    queryFn: () => apiService.getSalesMetrics({ time_period: timeFilter }),
  })

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team'],
    queryFn: () => apiService.getSalesTeam(),
  })

  const { data: opportunitiesData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['sales-opportunities'],
    queryFn: () => apiService.getSalesOpportunities({ limit: 20 }),
  })

  const { data: recentSalesData, isLoading: recentSalesLoading } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: () => apiService.getRecentSales({ limit: 20 }),
  })

  const { data: salesTrendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['sales-trends', chartTimeFilter, customDateRange, useCustomRange],
    queryFn: () => {
      if (useCustomRange && customDateRange.from && customDateRange.to) {
        return apiService.getSalesTrends({ 
          time_period: 'custom',
          start_date: customDateRange.from,
          end_date: customDateRange.to
        })
      }
      return apiService.getSalesTrends({ time_period: chartTimeFilter })
    },
  })

  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['top-customers'],
    queryFn: () => apiService.getTopCustomers({ limit: 20 }),
  })

  const { data: salesForecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['sales-forecast'],
    queryFn: () => apiService.getSalesForecast({ months: 6 }),
  })

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiService.getLeads({ limit: 20 }),
  })

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => apiService.getQuotes({ limit: 20 }),
  })

  const { data: mostUsedPartsData, isLoading: mostUsedPartsLoading } = useQuery({
    queryKey: ['most-used-parts'],
    queryFn: () => apiService.getMostUsedParts({ limit: 5 }),
  })

  const { data: repairTicketsData, isLoading: repairTicketsLoading } = useQuery({
    queryKey: ['repair-tickets'],
    queryFn: () => apiService.getRepairTickets({ limit: 20 }),
  })

  const { data: warrantyRepairTicketsData, isLoading: warrantyRepairTicketsLoading } = useQuery({
    queryKey: ['warranty-repair-tickets'],
    queryFn: () => apiService.getWarrantyRepairTickets({ limit: 20 }),
  })

  const { data: workOrdersData, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => apiService.getWorkOrders({ limit: 20 }),
  })

  const { data: warrantyWorkOrdersData, isLoading: warrantyWorkOrdersLoading } = useQuery({
    queryKey: ['warranty-work-orders'],
    queryFn: () => apiService.getWarrantyWorkOrders({ limit: 20 }),
  })

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiService.getCustomers({ limit: 20 }),
  })

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiService.getInventory({ limit: 20 }),
  })

  const isLoading = repairsLoading || salesLoading || teamLoading || opportunitiesLoading || 
    recentSalesLoading || trendsLoading || topCustomersLoading || forecastLoading ||
    leadsLoading || quotesLoading || repairTicketsLoading || warrantyRepairTicketsLoading ||
    workOrdersLoading || warrantyWorkOrdersLoading || customersLoading || inventoryLoading

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t('pages.overview.loading_dashboard')}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const dashboardData = repairsData?.data || {}
  const sales = salesData?.data || {}
  const team = teamData?.data?.team || []
  const opportunities = opportunitiesData?.data?.opportunities || []
  const recentSales = recentSalesData?.data?.sales || []
  const trends = salesTrendsData?.data || []
  const topCustomers = topCustomersData?.data?.customers || []
  const forecast = salesForecastData?.data?.forecast || []
  const leads = leadsData?.data || []
  const quotes = quotesData?.data || []
  const repairTickets = repairTicketsData?.data || []
  const warrantyRepairTickets = warrantyRepairTicketsData?.data || []
  const workOrders = workOrdersData?.data || []
  const warrantyWorkOrders = warrantyWorkOrdersData?.data || []
  const customers = customersData?.data || []
  const inventory = inventoryData?.data || []
  const mostUsedParts = mostUsedPartsData?.data || []

  // Extract work order data from nested structure
  const workOrdersStats = dashboardData.work_orders || {}
  
  // Calculate ACTIVE repairs (work orders + warranty work orders) - only non-completed statuses
  const activeStatuses = ['pending', 'in_progress', 'testing', 'parts_ordered', 'waiting_approval', 'waiting_supplier']
  
  // Filter work orders for active statuses
  const activeRegularWorkOrders = workOrders.filter((order: any) => 
    activeStatuses.includes(order.status?.toLowerCase())
  ).length
  
  const activeWarrantyWorkOrders = warrantyWorkOrders.filter((order: any) => 
    activeStatuses.includes(order.status?.toLowerCase())
  ).length
  
  const totalActiveWorkOrders = activeRegularWorkOrders + activeWarrantyWorkOrders

  // Calculate total repairs (all statuses) for breakdown section
  const totalRegularWorkOrders = workOrders.length
  const totalWarrantyWorkOrders = warrantyWorkOrders.length
  const totalWorkOrders = totalRegularWorkOrders + totalWarrantyWorkOrders

  // Calculate comprehensive metrics
  const totalRevenue = sales.totalRevenue || 0
  const totalSales = sales.totalSales || 0
  const avgSalePrice = sales.avgSalePrice || 0
  const conversionRate = sales.conversionRate || 0
  const winRate = sales.winRate || 0
  const totalLeads = leads.length || 0
  const totalQuotes = quotes.length || 0
  const totalCustomers = customers.length || 0
  const totalInventory = inventory.length || 0
  const lowStockItems = inventory.filter((item: any) => item.quantity <= (item.min_stock_level || 0)).length || 0

  // Helper functions (formatCurrency is now imported from lib/currency)

  // Date formatting functions are now imported from lib/dateTime

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUpIcon className="h-4 w-4 text-green-500" />
    if (change < 0) return <TrendingDownIcon className="h-4 w-4 text-red-500" />
    return <Activity className="h-4 w-4 text-gray-500" />
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': case 'urgent': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'average': return 'text-yellow-600'
      case 'needs_improvement': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }


  // Define all possible statuses with colors and display names
  const statusConfig: { [key: string]: { color: string; displayName: string } } = {
    'pending': { color: 'bg-yellow-500', displayName: 'Pending' },
    'in_progress': { color: 'bg-blue-500', displayName: 'In Progress' },
    'completed': { color: 'bg-green-500', displayName: 'Completed' },
    'cancelled': { color: 'bg-red-500', displayName: 'Cancelled' },
    'testing': { color: 'bg-purple-500', displayName: 'Testing' },
    'parts_ordered': { color: 'bg-orange-500', displayName: 'Parts Ordered' },
    'waiting_approval': { color: 'bg-indigo-500', displayName: 'Waiting Approval' },
    'waiting_supplier': { color: 'bg-pink-500', displayName: 'Waiting Supplier' },
    'service_cancelled': { color: 'bg-red-600', displayName: 'Service Cancelled' },
    'warranty_declined': { color: 'bg-red-700', displayName: 'Warranty Declined' }
  }
  
  // Calculate real repair status data from actual work orders
  const allWorkOrders = [...workOrders, ...warrantyWorkOrders]
  const statusCounts: { [key: string]: number } = {}
  
  // Initialize all statuses with 0 count
  Object.keys(statusConfig).forEach(status => {
    statusCounts[status] = 0
  })
  
  // Count each status from actual work orders
  allWorkOrders.forEach((order: any) => {
    const status = order.status?.toLowerCase()
    if (status && statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++
    }
    // Skip any unexpected statuses - don't count them
  })
  
  // Create repair status data array - show ALL statuses but only display count if > 0
  const repairStatusData = Object.entries(statusConfig)
    .map(([status, config]) => ({
      status: config.displayName,
      count: statusCounts[status] || 0,
      color: config.color
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending

  const leadSourceData = [
    { source: 'Website', leads: 35, revenue: 45000, percentage: 40 },
    { source: 'Referral', leads: 28, revenue: 38000, percentage: 32 },
    { source: 'Cold Call', leads: 15, revenue: 20000, percentage: 17 },
    { source: 'Social Media', leads: 10, revenue: 12000, percentage: 11 },
  ]

  const exportToCSV = (data: any[], filename: string) => {
    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.overview.title')}</h1>
            <p className="text-muted-foreground">
              {t('pages.overview.description')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">{t('pages.overview.metrics_period')}</Label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('pages.overview.metrics_period')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">{t('pages.overview.last_7_days')}</SelectItem>
                  <SelectItem value="30d">{t('pages.overview.last_30_days')}</SelectItem>
                  <SelectItem value="month">{t('pages.overview.this_month')}</SelectItem>
                  <SelectItem value="quarter">{t('pages.overview.this_quarter')}</SelectItem>
                  <SelectItem value="year">{t('pages.overview.this_year')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              refetchRepairs()
              refetchSales()
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('pages.overview.refresh')}
            </Button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.overview.total_revenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getChangeIcon(sales.revenueChange || 0)}
                <span>{sales.revenueChange || 0}{t('pages.overview.from_last_period')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.overview.active_repairs')}</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActiveWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                {activeRegularWorkOrders} {t('pages.overview.regular_warranties')} {activeWarrantyWorkOrders}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.overview.sales_pipeline')}</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{opportunities.length}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(opportunities.reduce((sum: number, opp: any) => sum + (opp.potential_value || 0), 0))} {t('pages.overview.potential_value')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.overview.customer_base')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {t('pages.overview.active_customers')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Comprehensive Analytics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Sales Performance Chart */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    {t('pages.overview.sales_performance_trend')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.revenue_metrics_description')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Time Period Selector */}
                  <Select value={useCustomRange ? 'custom' : chartTimeFilter} onValueChange={(value) => {
                    if (value === 'custom') {
                      setUseCustomRange(true)
                    } else {
                      setUseCustomRange(false)
                      setChartTimeFilter(value)
                    }
                  }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">{t('pages.overview.last_7_days')}</SelectItem>
                      <SelectItem value="month">{t('pages.overview.last_30_days')}</SelectItem>
                      <SelectItem value="quarter">{t('pages.overview.last_3_months')}</SelectItem>
                      <SelectItem value="year">{t('pages.overview.last_year')}</SelectItem>
                      <SelectItem value="custom">{t('pages.overview.custom_range')}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Custom Date Range Picker */}
                  {useCustomRange && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
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
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCustomDateRange({ from: '', to: '' })
                          setUseCustomRange(false)
                          setChartTimeFilter('month')
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <div className="space-y-4">
                  <ChartContainer
                    config={{
                      revenue: {
                        label: t('pages.overview.chart_labels.revenue'),
                        color: "hsl(var(--chart-1))",
                      },
                      sales: {
                        label: t('pages.overview.chart_labels.sales'),
                        color: "hsl(var(--chart-2))",
                      },
                      customers: {
                        label: t('pages.overview.chart_labels.customers'),
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-[300px] w-full"
                  >
                    <AreaChart data={trends}>
                      <defs>
                        <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--chart-1))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--chart-1))"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                        <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--chart-2))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--chart-2))"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                        <linearGradient id="fillCustomers" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--chart-3))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--chart-3))"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value} KM`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(value) => formatDate(value)}
                            formatter={(value, name) => [
                              name === 'revenue' ? `${formatCurrency(Number(value))} ${t('pages.overview.revenue')}` : `${value} ${name === 'sales' ? t('pages.overview.sales') : t('pages.overview.customers')}`,
                              ''
                            ]}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--chart-1))"
                        fill="url(#fillRevenue)"
                        stackId="a"
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="hsl(var(--chart-2))"
                        fill="url(#fillSales)"
                        stackId="b"
                      />
                      <Area
                        type="monotone"
                        dataKey="customers"
                        stroke="hsl(var(--chart-3))"
                        fill="url(#fillCustomers)"
                        stackId="c"
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                  </ChartContainer>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(trends.reduce((sum, t) => sum + (t.revenue || 0), 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('pages.overview.chart_metrics.total_revenue')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {trends.reduce((sum, t) => sum + (t.sales || 0), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('pages.overview.chart_metrics.total_sales')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {trends.reduce((sum, t) => sum + (t.customers || 0), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('pages.overview.chart_metrics.total_customers')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {trends.length > 0 ? (() => {
                          const totalRevenue = trends.reduce((sum, t) => sum + (t.revenue || 0), 0);
                          const totalSales = trends.reduce((sum, t) => sum + (t.sales || 0), 0);
                          return formatCurrency(totalSales > 0 ? totalRevenue / totalSales : 0);
                        })() : '0.00 KM'}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('pages.overview.chart_metrics.avg_sale_value')}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No sales trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                {t('pages.overview.repair_status')}
              </CardTitle>
              <CardDescription>{t('pages.overview.current_repair_distribution')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {repairStatusData.map((item, index) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <span className="text-sm">{item.status}</span>
                    </div>
                    <div className="text-sm font-medium">
                      {item.count > 0 ? item.count : ''}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Total Repairs</span>
                    <span className="font-medium">{totalWorkOrders}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Data Tables */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Sales Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('pages.overview.recent_sales')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.latest_sales_transactions')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(recentSales, 'recent-sales.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {sale.customer_name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{sale.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{sale.model_name} • {sale.serial_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(sale.sale_price || 0)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.sale_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Customers Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    {t('pages.overview.top_customers')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.highest_value_customers')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(topCustomers, 'top-customers.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {topCustomers.slice(0, 5).map((customer: any) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {customer.name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(customer.totalRevenue || 0)}</p>
                      <p className="text-xs text-muted-foreground">{customer.totalDeals} {t('pages.overview.deals')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technician Workload and Team Performance */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Technician Workload */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    {t('pages.overview.technician_workload')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.current_assignments')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV([...workOrders, ...warrantyWorkOrders], 'technician-workload.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(() => {
                  // Group work orders by technician
                  const technicianWorkload: { [key: string]: any } = {}
                  
                  const allOrders = [...workOrders, ...warrantyWorkOrders]
                  
                  for (const order of allOrders) {
                    const techId = order.technician_id || order.owner_technician_id
                    const techName = order.technician_name || order.owner_technician_name || t('pages.overview.unassigned')
                    
                    if (!technicianWorkload[techId]) {
                      technicianWorkload[techId] = {
                        id: techId,
                        name: techName,
                        regularWorkOrders: { low: 0, med: 0, high: 0, total: 0 },
                        warrantyWorkOrders: { low: 0, med: 0, high: 0, total: 0 },
                        totalWorkload: 0
                      }
                    }
                    
                    const priority = order.priority?.toLowerCase() === 'medium' ? 'med' : (order.priority?.toLowerCase() || 'med')
                    const isWarranty = order.is_warranty || (order.id && String(order.id).includes('warranty'))
                    
                    if (isWarranty) {
                      technicianWorkload[techId].warrantyWorkOrders[priority]++
                      technicianWorkload[techId].warrantyWorkOrders.total++
                    } else {
                      technicianWorkload[techId].regularWorkOrders[priority]++
                      technicianWorkload[techId].regularWorkOrders.total++
                    }
                    
                    technicianWorkload[techId].totalWorkload++
                  }
                  
                  const sortedTechnicians = Object.values(technicianWorkload)
                    .sort((a: any, b: any) => b.totalWorkload - a.totalWorkload)
                    .slice(0, 5)
                  
                  return sortedTechnicians.map((tech: any) => (
                    <div key={tech.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{tech.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs text-muted-foreground">
                              Regular: {tech.regularWorkOrders.total} 
                              ({tech.regularWorkOrders.high}H, {tech.regularWorkOrders.med}M, {tech.regularWorkOrders.low}L)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="text-xs text-muted-foreground">
                              Warranty: {tech.warrantyWorkOrders.total}
                              ({tech.warrantyWorkOrders.high}H, {tech.warrantyWorkOrders.med}M, {tech.warrantyWorkOrders.low}L)
                            </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{tech.totalWorkload} total</p>
                        <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                          <div 
                            className="h-2 bg-blue-500 rounded-full" 
                            style={{ width: `${Math.min((tech.totalWorkload / 10) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.min((tech.totalWorkload / 10) * 100, 100).toFixed(0)}% capacity
                        </p>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('pages.overview.team_performance')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.sales_team_metrics')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(team, 'team-performance.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team.slice(0, 8).map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {member.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.totalSales} {t('pages.overview.sales_label')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(member.totalRevenue || 0)}</p>
                      <div className="flex items-center gap-1">
                        <Progress value={member.completionRate || 0} className="w-16 h-2" />
                        <span className="text-xs text-muted-foreground">{member.completionRate || 0}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repair Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Repair Tickets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {t('pages.overview.recent_repair_tickets')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.latest_repair_submissions')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV([...repairTickets, ...warrantyRepairTickets], 'repair-tickets.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {[...repairTickets, ...warrantyRepairTickets].slice(0, 5).map((ticket: any, index: number) => (
                  <div key={`ticket-${ticket.id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ticket.formatted_number || ticket.ticket_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(ticket.status)}
                        {ticket.priority && (
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{ticket.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Work Orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    {t('pages.overview.active_work_orders')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.current_work_orders')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV([...workOrders, ...warrantyWorkOrders], 'work-orders.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {[...workOrders, ...warrantyWorkOrders].slice(0, 5).map((order: any, index: number) => (
                  <div key={`order-${order.id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{order.formatted_number || order.work_order_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(order.status)}
                        {order.priority && (
                          <Badge className={getPriorityColor(order.priority)}>
                            {order.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Most Repaired Machines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {t('pages.overview.most_repaired_machines')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.machine_models_most_paid')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(workOrders, 'most-repaired-machines.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(() => {
                  // Count repairs by machine model from regular work orders only
                  const machineRepairCounts: { [key: string]: any } = {}
                  
                  // Process only regular work orders (paid repairs)
                  for (const workOrder of workOrders) {
                    const modelName = workOrder.machine_name || 'Unknown Model'
                    const catalogueNumber = workOrder.catalogue_number || ''
                    const displayName = catalogueNumber ? `${modelName} (${catalogueNumber})` : modelName
                    const key = displayName
                    
                    if (!machineRepairCounts[key]) {
                      machineRepairCounts[key] = {
                        model: modelName,
                        catalogueNumber: catalogueNumber,
                        displayName: displayName,
                        count: 0
                      }
                    }
                    
                    machineRepairCounts[key].count++
                  }
                  
                  const sortedMachines = Object.values(machineRepairCounts)
                    .sort((a: any, b: any) => b.count - a.count)
                    .slice(0, 5)
                  
                  return sortedMachines.length > 0 ? (
                    sortedMachines.map((machine: any, index: number) => (
                      <div key={`machine-${machine.displayName}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{machine.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {machine.count} paid repairs
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{machine.count} repairs</p>
                          <p className="text-xs text-muted-foreground">#{index + 1} most repaired</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-sm text-muted-foreground">No repair data available</div>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Most Used Parts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('pages.overview.most_used_parts')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.inventory_most_frequent')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(mostUsedParts, 'most-used-parts.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mostUsedPartsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-muted-foreground">Loading most used parts...</div>
                </div>
              ) : mostUsedParts.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {mostUsedParts.map((part: any, index: number) => {
                    const maxUsage = mostUsedParts[0]?.total_quantity_used || 1
                    const usagePercentage = (part.total_quantity_used / maxUsage) * 100
                    
                    return (
                      <div key={`part-${part.id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{part.name}</p>
                          <p className="text-xs text-muted-foreground">{part.category}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Used in {part.work_orders_count} work orders
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{part.total_quantity_used} units</p>
                          <p className="text-xs text-muted-foreground">#{index + 1} most used</p>
                          <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className="h-2 bg-green-500 rounded-full" 
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-muted-foreground">No parts usage data available</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Most Warranty Machines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {t('pages.overview.most_warranty_machines')}
                  </CardTitle>
                  <CardDescription>{t('pages.overview.machine_models_most_warranty')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(warrantyWorkOrders, 'most-warranty-machines.csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pages.overview.export')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(() => {
                  // Count warranty repairs by machine model from warranty work orders only
                  const warrantyMachineCounts: { [key: string]: any } = {}
                  
                  // Process only warranty work orders
                  for (const workOrder of warrantyWorkOrders) {
                    const modelName = workOrder.machine_name || 'Unknown Model'
                    const catalogueNumber = workOrder.catalogue_number || ''
                    const displayName = catalogueNumber ? `${modelName} (${catalogueNumber})` : modelName
                    const key = displayName
                    
                    if (!warrantyMachineCounts[key]) {
                      warrantyMachineCounts[key] = {
                        model: modelName,
                        catalogueNumber: catalogueNumber,
                        displayName: displayName,
                        count: 0
                      }
                    }
                    
                    warrantyMachineCounts[key].count++
                  }
                  
                  const sortedWarrantyMachines = Object.values(warrantyMachineCounts)
                    .sort((a: any, b: any) => b.count - a.count)
                    .slice(0, 5)
                  
                  return sortedWarrantyMachines.length > 0 ? (
                    sortedWarrantyMachines.map((machine: any, index: number) => (
                      <div key={`warranty-machine-${machine.displayName}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{machine.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {machine.count} warranty repairs
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{machine.count} repairs</p>
                          <p className="text-xs text-muted-foreground">#{index + 1} most warranty</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-sm text-muted-foreground">No warranty repair data available</div>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}

export default DashboardOverview

