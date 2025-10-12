import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  FileText,
  Activity,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Printer
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '../components/ui/completed-item-alert-dialog'
import apiService from '../services/api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

interface WarrantyWorkOrder {
  id: string
  machine_id: string
  customer_id: string
  description?: string
  status: string
  technician_id?: string
  priority: string
  updated_at: string
  ticket_number?: string
  formatted_number?: string
  created_at: string
  started_at?: string
  completed_at?: string
  total_cost?: number | string
  labor_hours?: number | string
  labor_rate?: number | string
  quote_subtotal_parts?: number | string
  quote_total?: number | string
  troubleshooting_fee?: number | string
  converted_from_ticket_id?: string
  owner_technician_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  machine_name?: string
  serial_number?: string
  technician_name?: string
  owner_technician_name?: string
  estimated_hours?: number | string
  due_date?: string
  sales_opportunity?: boolean
  sales_notes?: string
  potential_value?: number | string
  sales_user_id?: string
  lead_quality?: string
  follow_up_date?: string
  customer_satisfaction_score?: number | string
  upsell_opportunity?: boolean
  recommended_products?: string
}

// Define columns for Warranty Work Orders table
const WARRANTY_WORK_ORDER_COLUMNS = defineColumns([
  { key: 'work_order_number', label: 'Work Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'machine', label: 'Machine' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'technician', label: 'Technician' },
  { key: 'created_at', label: 'Created' },
])

export default function WarrantyWorkOrders() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const [warrantyWorkOrders, setWarrantyWorkOrders] = useState<WarrantyWorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    technician: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)
  
  // Year filter state
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workOrderToDelete, setWorkOrderToDelete] = useState<WarrantyWorkOrder | null>(null)
  const [completedAlertOpen, setCompletedAlertOpen] = useState(false)
  const [completedWorkOrder, setCompletedWorkOrder] = useState<WarrantyWorkOrder | null>(null)

  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('warranty_work_orders', getDefaultColumnKeys(WARRANTY_WORK_ORDER_COLUMNS))

  // Initialize filters from URL parameters
  useEffect(() => {
    const priority = searchParams.get('priority')
    if (priority) {
      setFilters(prev => ({ ...prev, priority }))
    }
  }, [searchParams])

  // Fetch available years on mount
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await apiService.getWarrantyWorkOrderYears()
        const years = response.data || []
        setAvailableYears(years.length > 0 ? years : [currentYear])
      } catch (error) {
        console.error('Error fetching years:', error)
        setAvailableYears([currentYear])
      }
    }
    fetchYears()
  }, [])

  useEffect(() => {
    fetchWarrantyWorkOrders()
  }, [appliedSearchTerm, filters, currentPage, selectedYear])

  const fetchWarrantyWorkOrders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const searchParams: any = {
        page: currentPage,
        limit: pageSize,
        year: selectedYear
      }
      
      if (appliedSearchTerm) {
        searchParams.search = appliedSearchTerm
      }
      
      if (filters.status) {
        searchParams.status = filters.status
      }
      
      if (filters.priority) {
        searchParams.priority = filters.priority
      }
      
      if (filters.technician) {
        searchParams.technician_id = filters.technician
      }
      
      
      
      const response = await apiService.getWarrantyWorkOrders(searchParams) as any
      
      
      setWarrantyWorkOrders(response.data || [])
      setTotalPages(response.pagination?.pages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (err) {
      setError('Failed to load warranty work orders.')
      console.error('Error fetching warranty work orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewWorkOrder = (id: string) => {
    navigate(`/warranty-work-orders/${id}`)
  }

  const handleSearch = () => {
    setAppliedSearchTerm(searchTerm)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearchTerm('')
    setCurrentPage(1)
  }

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      technician: ''
    })
    setCurrentPage(1)
  }

  const getUniqueTechnicians = () => {
    const techniciansMap = new Map<string, string>()
    warrantyWorkOrders.forEach(workOrder => {
      if (workOrder.technician_id && workOrder.technician_name) {
        techniciansMap.set(workOrder.technician_id, workOrder.technician_name)
      }
    })
    return Array.from(techniciansMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }))
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  const handleEditWorkOrder = (id: string) => {
    navigate(`/warranty-work-orders/${id}`)
  }

  const handleAssignTechnician = (_id: string) => {
    // TODO: Implement technician assignment
    toast.info('Technician assignment feature coming soon')
  }

  const handleLogTime = (_id: string) => {
    // TODO: Implement time logging
    toast.info('Time logging feature coming soon')
  }

  const handleDeleteWorkOrder = (workOrder: WarrantyWorkOrder) => {
    if (workOrder.status === 'completed') {
      setCompletedWorkOrder(workOrder)
      setCompletedAlertOpen(true)
    } else {
      setWorkOrderToDelete(workOrder)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDeleteWorkOrder = async () => {
    if (!workOrderToDelete) return

    try {
      await apiService.deleteWarrantyWorkOrder(workOrderToDelete.id)
      toast.success('Warranty work order deleted successfully')
      setDeleteDialogOpen(false)
      setWorkOrderToDelete(null)
      fetchWarrantyWorkOrders()
    } catch (err: any) {
      console.error('Error deleting warranty work order:', err)
      toast.error(err.response?.data?.message || 'Failed to delete warranty work order')
    }
  }

  const handlePrintWorkOrder = async (workOrder: WarrantyWorkOrder) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-work-order/${workOrder.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank')
      if (newWindow) {
        newWindow.document.title = `Warranty Work Order ${workOrder.formatted_number || workOrder.id}`
      }
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error printing work order:', error)
      toast.error('Failed to print work order')
    }
  }

  const handleDownloadWorkOrder = async (workOrder: WarrantyWorkOrder) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-work-order/${workOrder.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `warranty-work-order-${workOrder.formatted_number || workOrder.id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading work order:', error)
      toast.error('Failed to download work order')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: Clock,
      quoted: FileText,
      awaiting_approval: Clock,
      declined: XCircle,
      pending: Clock,
      in_progress: Wrench,
      completed: CheckCircle,
      ready_for_pickup: CheckCircle,
      cancelled: XCircle,
      testing: Wrench,
      parts_ordered: Clock,
      waiting_approval: Clock,
      waiting_supplier: Clock,
      service_cancelled: XCircle,
      warranty_declined: XCircle
    }
    
    const Icon = statusIcons[status] || Clock
    
    return (
      <Badge 
        variant={getStatusBadgeVariant(status)} 
        className={`flex items-center gap-1 ${getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : ''}`}
      >
        <Icon className="h-3 w-3" />
        {formatStatus(status)}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Low' },
      medium: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
      high: { color: 'bg-red-50 text-red-700 border-red-200', label: 'High' },
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    )
  }



  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading warranty work orders...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchWarrantyWorkOrders}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warranty Work Orders</h1>
            <p className="text-muted-foreground">
              Manage warranty work orders and track progress
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {warrantyWorkOrders.filter(w => w.status === 'pending').length}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting start</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Activity className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {warrantyWorkOrders.filter(w => w.status === 'in_progress').length}
              </div>
              <p className="text-xs text-muted-foreground">Currently being worked on</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {warrantyWorkOrders.filter(w => w.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">Finished this period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warranty Declined</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {warrantyWorkOrders.filter(w => w.status === 'warranty_declined').length}
              </div>
              <p className="text-xs text-muted-foreground">Warranties not covered</p>
            </CardContent>
          </Card>
        </div>

        {/* Work Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search work orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    className="pl-10 w-80"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={handleClearSearch}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button onClick={handleSearch} variant="outline">
                  Search
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="relative">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {getActiveFiltersCount() > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {getActiveFiltersCount()}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Status Filter */}
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="intake">Intake</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                          <SelectItem value="parts_ordered">Parts Ordered</SelectItem>
                          <SelectItem value="waiting_approval">Waiting Approval</SelectItem>
                          <SelectItem value="waiting_supplier">Waiting Supplier</SelectItem>
                          <SelectItem value="service_cancelled">Service Cancelled</SelectItem>
                          <SelectItem value="warranty_declined">Warranty Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority Filter */}
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Priority</label>
                      <Select value={filters.priority || "all"} onValueChange={(value) => handleFilterChange('priority', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All priorities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All priorities</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Technician Filter */}
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Technician</label>
                      <Select value={filters.technician || "all"} onValueChange={(value) => handleFilterChange('technician', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All technicians" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All technicians</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {getUniqueTechnicians().map(tech => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Year Filter */}
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Year</label>
                      <Select value={selectedYear.toString()} onValueChange={(value) => {
                        setSelectedYear(parseInt(value))
                        setCurrentPage(1)
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableYears.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Column Visibility */}
                <ColumnVisibilityDropdown
                  columns={WARRANTY_WORK_ORDER_COLUMNS}
                  visibleColumns={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onShowAll={showAllColumns}
                  onHideAll={hideAllColumns}
                  onReset={resetColumns}
                  isSyncing={isSyncing}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isColumnVisible('work_order_number') && <TableHead>Work Order #</TableHead>}
                    {isColumnVisible('customer') && <TableHead>Customer</TableHead>}
                    {isColumnVisible('machine') && <TableHead>Machine</TableHead>}
                    {isColumnVisible('description') && <TableHead>Description</TableHead>}
                    {isColumnVisible('status') && <TableHead>Status</TableHead>}
                    {isColumnVisible('priority') && <TableHead>Priority</TableHead>}
                    {isColumnVisible('technician') && <TableHead>Technician</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warrantyWorkOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No warranty work orders found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    warrantyWorkOrders.map((workOrder, index) => (
                      <TableRow 
                        key={`warranty-workorder-${workOrder.id}-${index}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}
                      >
                        {isColumnVisible('work_order_number') && (
                          <TableCell className="font-medium">
                            {workOrder.formatted_number || `#${workOrder.id}`}
                          </TableCell>
                        )}
                        {isColumnVisible('customer') && (
                          <TableCell>{workOrder.customer_name || 'N/A'}</TableCell>
                        )}
                        {isColumnVisible('machine') && (
                          <TableCell>
                            <div>
                              <div className="font-medium">{workOrder.machine_name || 'N/A'}</div>
                              {workOrder.serial_number && (
                                <div className="text-sm text-muted-foreground">
                                  {workOrder.serial_number}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('description') && (
                          <TableCell className="max-w-xs">
                            <div className="truncate">
                              {workOrder.description || 'No description'}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('status') && (
                          <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                        )}
                        {isColumnVisible('priority') && (
                          <TableCell>{getPriorityBadge(workOrder.priority)}</TableCell>
                        )}
                        {isColumnVisible('technician') && (
                          <TableCell className="text-sm text-muted-foreground">
                            {workOrder.technician_name || 'Unassigned'}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleViewWorkOrder(workOrder.id)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {hasPermission('work_orders:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditWorkOrder(workOrder.id)
                                }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Work Order
                                </DropdownMenuItem>
                              )}
                              {hasPermission('work_orders:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleAssignTechnician(workOrder.id)
                                }}>
                                  <User className="mr-2 h-4 w-4" />
                                  Assign Technician
                                </DropdownMenuItem>
                              )}
                              {hasPermission('work_orders:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleLogTime(workOrder.id)
                                }}>
                                  <Clock className="mr-2 h-4 w-4" />
                                  Log Time
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handlePrintWorkOrder(workOrder)
                              }}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleDownloadWorkOrder(workOrder)
                              }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              {hasPermission('work_orders:delete') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteWorkOrder(workOrder)
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} warranty work orders
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteWorkOrder}
          title="Delete Warranty Work Order"
          description={`Are you sure you want to delete warranty work order ${workOrderToDelete?.formatted_number}? This action cannot be undone.`}
        />

        {/* Completed Work Order Alert Dialog */}
        <CompletedItemAlertDialog
          open={completedAlertOpen}
          onOpenChange={setCompletedAlertOpen}
          title="Cannot Delete Completed Work Order"
          description={`Warranty work order ${completedWorkOrder?.formatted_number} is completed and cannot be deleted.`}
        />
      </div>
    </MainLayout>
  )
}
