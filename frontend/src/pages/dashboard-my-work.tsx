import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { QuickCreateButton } from '../components/dashboard/quick-create-button'
import { 
  User, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Wrench, 
  DollarSign,
  Calendar,
  Target,
  RefreshCw,
  Plus,
  TrendingUp
} from 'lucide-react'
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
import { apiService } from '../services/api'
import { useAuth } from '../contexts/auth-context'
import { useState } from 'react'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime, formatDateMedium } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'

const DashboardMyWork = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [timeFilter, setTimeFilter] = useState('month')
  const [viewLeadDialogOpen, setViewLeadDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)

  // Fetch user-specific data based on role
  const { data: myRepairsData, isLoading: repairsLoading, error: repairsError } = useQuery({
    queryKey: ['my-repairs', user?.id],
    queryFn: () => apiService.getMyRepairs(user?.id),
    enabled: !!user?.id && (user?.role === 'technician' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: myWarrantyRepairsData, isLoading: warrantyRepairsLoading, error: warrantyRepairsError } = useQuery({
    queryKey: ['my-warranty-repairs', user?.id],
    queryFn: () => apiService.getWarrantyRepairTickets({ technician_id: user?.id }),
    enabled: !!user?.id && (user?.role === 'technician' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: myWorkOrdersData, isLoading: workOrdersLoading, error: workOrdersError } = useQuery({
    queryKey: ['my-work-orders', user?.id],
    queryFn: () => apiService.getWorkOrders({ technician_id: user?.id }),
    enabled: !!user?.id && (user?.role === 'technician' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: myWarrantyWorkOrdersData, isLoading: warrantyWorkOrdersLoading, error: warrantyWorkOrdersError } = useQuery({
    queryKey: ['my-warranty-work-orders', user?.id],
    queryFn: () => apiService.getWarrantyWorkOrders({ technician_id: user?.id }),
    enabled: !!user?.id && (user?.role === 'technician' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: mySalesData, isLoading: salesLoading, error: salesError } = useQuery({
    queryKey: ['my-sales', user?.id],
    queryFn: () => apiService.getMySales(user?.id),
    enabled: !!user?.id && (user?.role === 'sales' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: myLeadsData, isLoading: leadsLoading, error: leadsError } = useQuery({
    queryKey: ['my-leads', user?.id],
    queryFn: () => apiService.getMyLeads(user?.id),
    enabled: !!user?.id && (user?.role === 'sales' || user?.role === 'manager' || user?.role === 'admin'),
  })

  const { data: mySalesTrendsData, isLoading: salesTrendsLoading, error: salesTrendsError } = useQuery({
    queryKey: ['my-sales-trends', user?.id, timeFilter],
    queryFn: () => apiService.getSalesTrends({ time_period: timeFilter, sales_person: user?.id }),
    enabled: !!user?.id && (user?.role === 'sales' || user?.role === 'manager' || user?.role === 'admin'),
  })

  // Fetch performance metrics for technicians only
  const { data: performanceData, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['my-performance', user?.id],
    queryFn: () => apiService.getDashboardStats(),
    enabled: !!user?.id && user?.role === 'technician',
  })

  // Fetch sales targets for sales users only (DISABLED for now to fix login issue)
  // const { data: salesTargetsData, isLoading: salesTargetsLoading, error: salesTargetsError } = useQuery({
  //   queryKey: ['my-sales-targets', user?.id],
  //   queryFn: () => apiService.getSalesTargets({ user_id: user?.id }),
  //   enabled: !!user?.id && user?.role === 'sales' && !!localStorage.getItem('token'),
  //   retry: false, // Don't retry on failure
  //   refetchOnWindowFocus: false, // Don't refetch on window focus
  // })
  
  // Temporary: Set empty data to prevent errors
  const salesTargetsData = { data: { targets: [] } }
  const salesTargetsLoading = false
  const salesTargetsError = null

  // Role-based loading and error states
  const isLoading = (user?.role === 'technician' && (repairsLoading || warrantyRepairsLoading || workOrdersLoading || warrantyWorkOrdersLoading || performanceLoading)) ||
                   (user?.role === 'sales' && (salesLoading || leadsLoading || salesTrendsLoading)) ||
                   ((user?.role === 'manager' || user?.role === 'admin') && (repairsLoading || warrantyRepairsLoading || workOrdersLoading || warrantyWorkOrdersLoading || salesLoading || leadsLoading || salesTrendsLoading))
  
  const hasError = (user?.role === 'technician' && (repairsError || warrantyRepairsError || workOrdersError || warrantyWorkOrdersError || performanceError)) ||
                  (user?.role === 'sales' && (salesError || leadsError || salesTrendsError)) ||
                  ((user?.role === 'manager' || user?.role === 'admin') && (repairsError || warrantyRepairsError || workOrdersError || warrantyWorkOrdersError || salesError || leadsError || salesTrendsError))

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading your work dashboard...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (hasError) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Work</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}! Here's your personal dashboard.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-medium">Error loading data</h3>
            </div>
            <p className="text-red-700 mt-2">
              There was an error loading your work data. Please try refreshing the page.
            </p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const myRepairs = Array.isArray((myRepairsData as any)?.data) ? (myRepairsData as any).data : []
  const myWarrantyRepairs = Array.isArray((myWarrantyRepairsData as any)?.data) ? (myWarrantyRepairsData as any).data : []
  const myWorkOrders = Array.isArray((myWorkOrdersData as any)?.data) ? (myWorkOrdersData as any).data : []
  const myWarrantyWorkOrders = Array.isArray((myWarrantyWorkOrdersData as any)?.data) ? (myWarrantyWorkOrdersData as any).data : []
  const mySales = Array.isArray((mySalesData as any)?.data?.sales) ? (mySalesData as any).data.sales : []
  const myLeads = Array.isArray((myLeadsData as any)?.data) ? (myLeadsData as any).data : []
  const mySalesTrends = Array.isArray((mySalesTrendsData as any)?.data) ? (mySalesTrendsData as any).data : []
  const performance = (performanceData as any)?.data || {}
  const salesTargets = (salesTargetsData as any)?.data?.targets || []
  
  // Combine regular and warranty repair tickets
  const allMyRepairTickets = [...myRepairs, ...myWarrantyRepairs]

  // Calculate personal metrics based on role
  const completedRepairs = myRepairs.filter((repair: any) => repair.status === 'completed').length
  
  // Calculate total revenue from completed work orders
  const completedWorkOrders = myWorkOrders.filter((order: any) => order.status === 'completed')
  const completedWarrantyWorkOrders = myWarrantyWorkOrders.filter((order: any) => order.status === 'completed')
  const workOrdersRevenue = [...completedWorkOrders, ...completedWarrantyWorkOrders]
    .reduce((sum, order) => sum + (parseFloat(order.total_cost) || 0), 0)
  
  // Work order metrics
  const totalWorkOrders = myWorkOrders.length
  const totalWarrantyWorkOrders = myWarrantyWorkOrders.length
  const totalAllWorkOrders = totalWorkOrders + totalWarrantyWorkOrders
  
  // Active work orders (pending and in progress)
  const activeWorkOrders = myWorkOrders.filter((order: any) => ['pending', 'in_progress'].includes(order.status))
  const activeWarrantyWorkOrders = myWarrantyWorkOrders.filter((order: any) => ['pending', 'in_progress'].includes(order.status))

  // Click handlers for navigation
  const handleWorkOrderClick = (workOrderId: string) => {
    navigate(`/work-orders/${workOrderId}`)
  }

  const handleWarrantyWorkOrderClick = (workOrderId: string) => {
    navigate(`/warranty-work-orders/${workOrderId}`)
  }

  // Click handlers for repair tickets
  const handleRepairTicketClick = (ticketId: string, isWarranty: boolean) => {
    if (isWarranty) {
      navigate(`/warranty-repair-tickets/${ticketId}`)
    } else {
      navigate(`/repair-tickets/${ticketId}`)
    }
  }

  const handleLeadClick = (lead: any) => {
    setSelectedLead(lead)
    setViewLeadDialogOpen(true)
  }

  const handleCloseViewLeadDialog = () => {
    setViewLeadDialogOpen(false)
    setSelectedLead(null)
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge 
        variant={getStatusBadgeVariant(status)} 
        className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : ''}
      >
        {formatStatus(status)}
      </Badge>
    )
  }
  
  const totalSales = mySales.length
  const totalRevenue = mySales.reduce((sum: number, sale: any) => sum + (sale.sale_price || 0), 0)
  const activeLeads = myLeads.filter((lead: any) => !['won', 'lost'].includes(lead.sales_stage)).length

  // Calculate sales target achievement
  const currentMonthTarget = salesTargets.find((target: any) => 
    target.target_type === 'monthly' && 
    new Date(target.target_period_start) <= new Date() && 
    new Date(target.target_period_end) >= new Date()
  )
  const targetAchievement = currentMonthTarget && currentMonthTarget.target_amount > 0 
    ? Math.round((totalRevenue / currentMonthTarget.target_amount) * 100) 
    : 0

  // Helper functions for chart (formatCurrency is now imported from lib/currency)

  // Date formatting functions are now imported from lib/dateTime

  // Role-specific metrics
  const isTechnician = user?.role === 'technician'
  const isSales = user?.role === 'sales'
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Work</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}! Here's your personal dashboard.
            </p>
          </div>
          <div className="flex gap-2">
            <QuickCreateButton />
          </div>
        </div>

        {/* Personal Metrics - Role Specific */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Technician Metrics */}
          {isTechnician && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Regular Repairs</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalWorkOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Regular work orders assigned to you
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Warranty Repairs</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalWarrantyWorkOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Warranty work orders assigned to you
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(workOrdersRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    From completed work orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performance</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performance.my_work_order_completion_rate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completion rate
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Sales Metrics */}
          {isSales && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Sales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalSales} sales this period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeLeads}</div>
                  <p className="text-xs text-muted-foreground">
                    Sales opportunities
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quotes Sent</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">
                    This month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performance</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{targetAchievement}%</div>
                  <p className="text-xs text-muted-foreground">
                    Target achievement
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Manager/Admin Metrics */}
          {isManagerOrAdmin && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Regular Repairs</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalWorkOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Regular work orders assigned to you
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Warranty Repairs</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalWarrantyWorkOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Warranty work orders assigned to you
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Sales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalSales} sales this period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Leads</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeLeads}</div>
                  <p className="text-xs text-muted-foreground">
                    Active opportunities
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* My Tasks - Role Specific */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Technician Tasks */}
          {isTechnician && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    My Open Work
                  </CardTitle>
                  <CardDescription>Your pending and in progress repairs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Regular Work Orders */}
                  {activeWorkOrders.slice(0, 3).map((order: any) => (
                    <div 
                      key={order.id} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleWorkOrderClick(order.id)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">#{order.formatted_number || order.work_order_number}</p>
                        <p className="text-xs text-muted-foreground ">
                          {order.customer_name} - {order.machine_name}
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          SN: {order.serial_number} | Cat: {order.catalogue_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                  
                  {/* Warranty Work Orders */}
                  {activeWarrantyWorkOrders.slice(0, 2).map((order: any) => (
                    <div 
                      key={`warranty-${order.id}`} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleWarrantyWorkOrderClick(order.id)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          #{order.formatted_number || order.work_order_number} 
                          <span className="text-blue-600 ml-1">(Warranty)</span>
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          {order.customer_name} - {order.machine_name}
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          SN: {order.serial_number} | Cat: {order.catalogue_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                  
                  {activeWorkOrders.length === 0 && activeWarrantyWorkOrders.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active work orders assigned to you
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    My Repair Tickets
                  </CardTitle>
                  <CardDescription>Your assigned repair tickets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {allMyRepairTickets.slice(0, 5).map((repair: any) => {
                    // Check if this is a warranty repair ticket by checking if it exists in myWarrantyRepairs
                    const isWarrantyTicket = myWarrantyRepairs.some((warrantyRepair: any) => warrantyRepair.id === repair.id)
                    
                    return (
                      <div 
                        key={repair.id} 
                        className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRepairTicketClick(repair.id, isWarrantyTicket)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            #{repair.formatted_number || repair.ticket_number}
                            {isWarrantyTicket && <span className="text-blue-600 ml-1">(Warranty)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground ">
                            {repair.customer_name} - {repair.model_name}
                          </p>
                          <p className="text-xs text-muted-foreground ">
                            SN: {repair.serial_number} | Cat: {repair.catalogue_number || 'N/A'}
                          </p>
                        </div>
                        {getStatusBadge(repair.status)}
                      </div>
                    )
                  })}
                  {allMyRepairTickets.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No repair tickets assigned to you
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Sales Tasks */}
          {isSales && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    My Active Leads
                  </CardTitle>
                  <CardDescription>Your sales opportunities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myLeads.slice(0, 5).map((lead: any) => (
                    <div 
                      key={lead.id} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleLeadClick(lead)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{lead.customer_name}</p>
                        <p className="text-xs text-muted-foreground ">
                          {lead.company_name} - {lead.lead_quality}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className=""
                        >
                          {lead.sales_stage}
                        </Badge>
                        <span className="text-sm font-medium">{formatCurrency(lead.potential_value || 0)}</span>
                      </div>
                    </div>
                  ))}
                  {myLeads.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active leads assigned to you
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Follow-ups Due
                  </CardTitle>
                  <CardDescription>Leads requiring follow-up</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myLeads.filter((lead: any) => lead.next_follow_up && new Date(lead.next_follow_up) <= new Date()).slice(0, 5).map((lead: any) => (
                    <div 
                      key={lead.id} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleLeadClick(lead)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{lead.customer_name}</p>
                        <p className="text-xs text-muted-foreground ">
                          Due: {new Date(lead.next_follow_up).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Overdue</Badge>
                      </div>
                    </div>
                  ))}
                  {myLeads.filter((lead: any) => lead.next_follow_up && new Date(lead.next_follow_up) <= new Date()).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No follow-ups due
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Manager/Admin Tasks */}
          {isManagerOrAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    My Open Work
                  </CardTitle>
                  <CardDescription>Your pending and in progress repairs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Regular Work Orders */}
                  {activeWorkOrders.slice(0, 3).map((order: any) => (
                    <div 
                      key={order.id} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleWorkOrderClick(order.id)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">#{order.formatted_number || order.work_order_number}</p>
                        <p className="text-xs text-muted-foreground ">
                          {order.customer_name} - {order.machine_name}
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          SN: {order.serial_number} | Cat: {order.catalogue_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                  
                  {/* Warranty Work Orders */}
                  {activeWarrantyWorkOrders.slice(0, 2).map((order: any) => (
                    <div 
                      key={`warranty-${order.id}`} 
                      className="group flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleWarrantyWorkOrderClick(order.id)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          #{order.formatted_number || order.work_order_number} 
                          <span className="text-blue-600 ml-1">(Warranty)</span>
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          {order.customer_name} - {order.machine_name}
                        </p>
                        <p className="text-xs text-muted-foreground ">
                          SN: {order.serial_number} | Cat: {order.catalogue_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                  
                  {activeWorkOrders.length === 0 && activeWarrantyWorkOrders.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active work orders assigned to you
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    My Sales
                  </CardTitle>
                  <CardDescription>Your recent sales</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mySales.slice(0, 5).map((sale: any) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{sale.customer_name}</p>
                        <p className="text-xs text-muted-foreground ">
                          {sale.model_name} - {sale.sale_date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(sale.sale_price || 0)}</p>
                      </div>
                    </div>
                  ))}
                  {mySales.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sales recorded yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Sales Performance Chart */}
        {(isSales || isManagerOrAdmin) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    My Sales Performance
                  </CardTitle>
                  <CardDescription>Your sales trends and performance over time</CardDescription>
                </div>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="quarter">Last 90 days</SelectItem>
                    <SelectItem value="year">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {salesTrendsLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading sales trends...</p>
                  </div>
                </div>
              ) : mySalesTrends.length > 0 ? (
                <>
                  <ChartContainer
                    config={{
                      revenue: {
                        label: "Revenue",
                        color: "hsl(var(--chart-1))",
                      },
                      sales: {
                        label: "Sales",
                        color: "hsl(var(--chart-2))",
                      },
                      customers: {
                        label: "Customers",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-[300px] w-full"
                  >
                    <AreaChart data={mySalesTrends}>
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
                              name === 'revenue' ? `${formatCurrency(Number(value))} Revenue` : `${value} ${name === 'sales' ? 'Sales' : 'Customers'}`,
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
                        {formatCurrency(mySalesTrends.reduce((sum, t) => sum + (t.revenue || 0), 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {mySalesTrends.reduce((sum, t) => sum + (t.sales || 0), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Sales</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {mySalesTrends.reduce((sum, t) => sum + (t.customers || 0), 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Customers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {mySalesTrends.reduce((sum, t) => sum + (t.sales || 0), 0) > 0 ? formatCurrency(mySalesTrends.reduce((sum, t) => sum + (t.revenue || 0), 0) / mySalesTrends.reduce((sum, t) => sum + (t.sales || 0), 0)) : '0.00 KM'}
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Sale Value</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No sales data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* View Lead Dialog */}
      <ViewLeadDialog
        isOpen={viewLeadDialogOpen}
        onClose={handleCloseViewLeadDialog}
        lead={selectedLead}
        users={[]}
      />
    </MainLayout>
  )
}

// Helper functions (formatCurrency is now imported from lib/currency)

// Date formatting functions are now imported from lib/dateTime

const getQualityColor = (quality: string) => {
  switch (quality) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'contacted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'qualified': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
    case 'proposal': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'negotiation': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'won': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'lost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

// Sales stages for display
const SALES_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
]

// View Lead Dialog Component
function ViewLeadDialog({
  isOpen,
  onClose,
  lead,
  users
}: {
  isOpen: boolean
  onClose: () => void
  lead: any
  users: any[]
}) {
  if (!lead) return null

  const assignedUser = users.find(u => u.id === lead.assigned_to)
  const createdByUser = users.find(u => u.name === lead.created_by_name)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
          <DialogDescription>
            View detailed information about this lead including customer details, lead information, and sales notes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                <p className="text-sm">{lead.customer_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                <p className="text-sm">{lead.company_name || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{lead.email || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <p className="text-sm">{lead.phone || '-'}</p>
              </div>
            </div>
          </div>

          {/* Lead Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Lead Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Potential Value</Label>
                <p className="text-sm font-medium">{formatCurrency(lead.potential_value || 0)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Lead Quality</Label>
                <Badge className={getQualityColor(lead.lead_quality)}>
                  {lead.lead_quality}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Sales Stage</Label>
                <Badge className={getStageColor(lead.sales_stage)}>
                  {SALES_STAGES.find(s => s.value === lead.sales_stage)?.label || lead.sales_stage}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Source</Label>
                <p className="text-sm">{lead.source || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Assigned To</Label>
                <p className="text-sm">{assignedUser?.name || 'Unassigned'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created By</Label>
                <p className="text-sm">{createdByUser?.name || lead.created_by_name || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Next Follow-up</Label>
                <p className="text-sm">{lead.next_follow_up ? formatDate(lead.next_follow_up) : '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
                <p className="text-sm">{formatDate(lead.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Sales Notes */}
          {lead.sales_notes && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Sales Notes</Label>
              <p className="text-sm bg-muted p-3 rounded-md">{lead.sales_notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DashboardMyWork
