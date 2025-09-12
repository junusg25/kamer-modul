import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Progress } from '../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target, 
  Phone, 
  Mail, 
  RefreshCw,
  Star,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime } from '../lib/dateTime'

interface SalesMetrics {
  totalSales: number
  totalRevenue: number
  avgSalePrice: number
  salesOpportunities: number
  salesChange: number
  revenueChange: number
  avgPriceChange: number
}

interface SalesTeamMember {
  id: number
  name: string
  totalSales: number
  totalRevenue: number
  target: number
  completionRate: number
}

interface SalesOpportunity {
  id: number
  customer_name: string
  company_name?: string
  potential_value: number
  lead_quality: 'high' | 'medium' | 'low'
  sales_stage: string
  assigned_to_name?: string
  next_follow_up?: string
  sales_notes?: string
}

interface RecentSale {
  id: number
  customer_name: string
  company_name?: string
  model_name: string
  serial_number: string
  sold_by_name: string
  sale_price: number
  sale_date: string
}

export default function SalesDashboard() {
  const { user } = useAuth()
  const [timeFilter, setTimeFilter] = useState('month')
  const [salesPersonFilter, setSalesPersonFilter] = useState('all')

  // Fetch sales metrics
  const { data: salesMetricsData, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ['sales-metrics', timeFilter, salesPersonFilter],
    queryFn: () => apiService.getSalesMetrics({ 
      time_period: timeFilter, 
      sales_person: salesPersonFilter === 'all' ? undefined : salesPersonFilter 
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const salesMetrics = salesMetricsData?.data || null

  // Fetch sales team
  const { data: salesTeamData, isLoading: teamLoading } = useQuery({
    queryKey: ['sales-team'],
    queryFn: () => apiService.getSalesTeam(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const salesTeam = salesTeamData?.team || []

  // Fetch sales opportunities
  const { data: salesOpportunitiesData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['sales-opportunities', timeFilter, salesPersonFilter],
    queryFn: () => apiService.getSalesOpportunities({ 
      limit: 10,
      assigned_to: salesPersonFilter === 'all' ? undefined : salesPersonFilter 
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const salesOpportunities = salesOpportunitiesData?.data?.opportunities || []

  // Fetch recent sales
  const { data: recentSalesData, isLoading: recentSalesLoading } = useQuery({
    queryKey: ['recent-sales', timeFilter, salesPersonFilter],
    queryFn: () => apiService.getRecentSales({ 
      limit: 5,
      time_period: timeFilter,
      sales_person: salesPersonFilter === 'all' ? undefined : salesPersonFilter 
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const recentSales = recentSalesData?.data?.sales || []

  const isLoading = metricsLoading || teamLoading || opportunitiesLoading || recentSalesLoading
  
  // Show loading state if any data is still loading
  if (isLoading && !salesMetrics && !salesTeam.length && !salesOpportunities.length && !recentSales.length) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading sales dashboard...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (change < 0) return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
    return null
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  // formatCurrency is now imported from lib/currency

  // Date formatting functions are now imported from lib/dateTime

  const handleRefresh = () => {
    refetchMetrics()
    // Other queries will auto-refresh due to React Query's refetch behavior
  }

  return (
    <MainLayout>
      <div className="space-y-6">
      {/* Error Display */}
      {metricsError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading sales data
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {metricsError.message || 'Failed to load sales metrics. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Dashboard</h1>
          <p className="text-muted-foreground">
            Track sales performance and opportunities
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={salesPersonFilter} onValueChange={setSalesPersonFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sales Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Salespeople</SelectItem>
              <SelectItem value="1">John Smith</SelectItem>
              <SelectItem value="2">Sarah Johnson</SelectItem>
              <SelectItem value="3">Mike Wilson</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sales Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (salesMetrics?.totalSales || 0)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {salesMetrics && getChangeIcon(salesMetrics.salesChange)}
              <span className={salesMetrics?.salesChange && salesMetrics.salesChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {salesMetrics ? Math.abs(salesMetrics.salesChange) : 0}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(salesMetrics?.totalRevenue || 0)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {salesMetrics && getChangeIcon(salesMetrics.revenueChange)}
              <span className={salesMetrics?.revenueChange && salesMetrics.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {salesMetrics ? Math.abs(salesMetrics.revenueChange) : 0}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Sale Price</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(salesMetrics?.avgSalePrice || 0)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {salesMetrics && getChangeIcon(salesMetrics.avgPriceChange)}
              <span className={salesMetrics?.avgPriceChange && salesMetrics.avgPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {salesMetrics ? Math.abs(salesMetrics.avgPriceChange) : 0}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (salesMetrics?.salesOpportunities || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesOpportunities ? formatCurrency(salesOpportunities.reduce((sum, opp) => sum + opp.potential_value, 0)) : '€0'} potential
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Team Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Sales Team Performance</span>
            </CardTitle>
            <CardDescription>
              Team performance and target completion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Loading team data...</p>
              </div>
            ) : salesTeam && salesTeam.length > 0 ? salesTeam.map((member) => (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.totalSales} sales • {formatCurrency(member.totalRevenue)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{Math.round(member.completionRate)}%</p>
                    <p className="text-xs text-muted-foreground">of target</p>
                  </div>
                </div>
                <Progress value={member.completionRate} className="h-2" />
              </div>
            )) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No team data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Sales Opportunities</span>
            </CardTitle>
            <CardDescription>
              High-value leads requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Loading opportunities...</p>
              </div>
            ) : !salesOpportunities || salesOpportunities.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No opportunities found</p>
                <p className="text-xs text-muted-foreground">All opportunities have been converted</p>
              </div>
            ) : (
              salesOpportunities.slice(0, 5).map((opportunity) => (
                <div key={opportunity.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Building2 className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{opportunity.customer_name}</p>
                      {opportunity.company_name && (
                        <p className="text-xs text-muted-foreground">{opportunity.company_name}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={`text-xs ${getQualityColor(opportunity.lead_quality)}`}>
                          {opportunity.lead_quality}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(opportunity.potential_value)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {salesOpportunities && salesOpportunities.length > 5 && (
              <div className="text-center">
                <Button variant="outline" size="sm">
                  View All ({salesOpportunities.length - 5} more)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Recent Sales Activity</span>
          </CardTitle>
          <CardDescription>
            Latest sales and customer interactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Loading recent sales...</p>
              </div>
            ) : recentSales && recentSales.length > 0 ? recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm font-medium">{formatDate(sale.sale_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{sale.customer_name}</p>
                    {sale.company_name && (
                      <p className="text-xs text-muted-foreground">{sale.company_name}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{sale.model_name}</p>
                    <p className="text-xs text-muted-foreground">SN: {sale.serial_number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{sale.sold_by_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(sale.sale_price)}</p>
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                </div>
              </div>
            )) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No recent sales found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </MainLayout>
  )
}
