import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '@/components/ui/completed-item-alert-dialog'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Clock,
  User,
  Calendar,
  DollarSign,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Printer,
  FileText
} from 'lucide-react'
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/currency'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

interface WorkOrder {
  id: string
  work_order_number?: string
  formatted_number?: string
  customer_name?: string
  machine_name?: string
  model_name?: string
  description?: string
  status?: string
  priority?: string
  technician_name?: string
  estimated_hours?: number
  actual_hours?: number
  total_cost?: number
  quote_total?: number
  labor_hours?: number
  labor_rate?: number
  troubleshooting_fee?: number
  quote_subtotal_parts?: number
  created_at: string
  updated_at: string
}

const getStatusBadge = (status?: string) => {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  
  return (
    <Badge 
      variant={getStatusBadgeVariant(status)} 
      className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : undefined}
    >
      {formatStatus(status)}
    </Badge>
  )
}

const getPriorityBadge = (priority?: string) => {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">High</Badge>
    case 'medium':
      return <Badge variant="outline" className="border-orange-300 text-orange-700">Medium</Badge>
    case 'low':
      return <Badge variant="outline" className="border-green-300 text-green-700">Low</Badge>
    default:
      return <Badge variant="outline">{priority || 'Normal'}</Badge>
  }
}

// Define columns for Work Orders table
const WORK_ORDER_COLUMNS = defineColumns([
  { key: 'work_order_number', label: 'Work Order #' },
  { key: 'customer', label: 'Customer' },
  { key: 'machine', label: 'Machine' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'technician', label: 'Technician' },
  { key: 'cost', label: 'Cost' },
])

export default function WorkOrders() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
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
  const [error, setError] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workOrderToDelete, setWorkOrderToDelete] = useState<WorkOrder | null>(null)
  const [completedAlertOpen, setCompletedAlertOpen] = useState(false)
  const [completedWorkOrder, setCompletedWorkOrder] = useState<WorkOrder | null>(null)

  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('work_orders', getDefaultColumnKeys(WORK_ORDER_COLUMNS))

  // Initialize filters from URL parameters
  useEffect(() => {
    const priority = searchParams.get('priority')
    if (priority) {
      setFilters(prev => ({ ...prev, priority }))
    }
  }, [searchParams])

  useEffect(() => {
    fetchWorkOrders()
  }, [appliedSearchTerm, filters, currentPage])

  const fetchWorkOrders = async () => {
    try {
      setIsLoading(true)
      const searchParams: any = {
        page: currentPage,
        limit: pageSize
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
      
      
      
      const response = await apiService.getWorkOrders(searchParams)
      
      
      const workOrdersData = response.data || []
      setWorkOrders(workOrdersData)
      setTotalPages(response.pagination?.pages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (err) {
      setError('Failed to load work orders')
      console.error('Error fetching work orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewWorkOrder = (workOrderId: string) => {
    navigate(`/work-orders/${workOrderId}`)
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
    workOrders.forEach(workOrder => {
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

  const handleEditWorkOrder = (workOrderId: string) => {
    navigate(`/work-orders/${workOrderId}`)
  }

  const handleAssignTechnician = (workOrderId: string) => {
    // TODO: Implement technician assignment modal
    
  }

  const handleLogTime = (workOrderId: string) => {
    // TODO: Implement time logging modal
    
  }

  const handleDeleteWorkOrder = (workOrder: WorkOrder) => {
    // Check if work order is completed
    if (workOrder.status === 'completed') {
      setCompletedWorkOrder(workOrder)
      setCompletedAlertOpen(true)
      return
    }
    
    setWorkOrderToDelete(workOrder)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteWorkOrder = async () => {
    if (!workOrderToDelete) return

    try {
      await apiService.deleteWorkOrder(workOrderToDelete.id)
      // Refresh the work orders list
      fetchWorkOrders()
      toast.success('Work order deleted successfully')
    } catch (error) {
      console.error('Error deleting work order:', error)
      toast.error('Failed to delete work order. Please try again.')
    } finally {
      setDeleteDialogOpen(false)
      setWorkOrderToDelete(null)
    }
  }

  const handlePrintWorkOrder = async (workOrder: WorkOrder) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/work-order/${workOrder.id}`, {
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
        newWindow.document.title = `Work Order ${workOrder.formatted_number || workOrder.id}`
      }
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error printing work order:', error)
      toast.error('Failed to print work order')
    }
  }

  const handleDownloadWorkOrder = async (workOrder: WorkOrder) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/work-order/${workOrder.id}`, {
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
      link.download = `work-order-${workOrder.formatted_number || workOrder.id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading work order:', error)
      toast.error('Failed to download work order')
    }
  }

  const pendingWorkOrders = workOrders.filter(w => w.status === 'pending')
  const inProgressWorkOrders = workOrders.filter(w => w.status === 'in_progress')
  const completedWorkOrders = workOrders.filter(w => w.status === 'completed')

  const calculateWorkOrderCost = (workOrder: WorkOrder) => {
    // Use total_cost if available (preferred method)
    if (workOrder.total_cost !== null && workOrder.total_cost !== undefined) {
      const cost = Number(workOrder.total_cost) || 0
      return cost
    }
    
    // Fallback to manual calculation if total_cost is not available
    const laborHours = parseFloat(workOrder.labor_hours?.toString() || '0') || 0
    const laborRate = parseFloat(workOrder.labor_rate?.toString() || '0') || 0
    const partsCost = parseFloat(workOrder.quote_subtotal_parts?.toString() || '0') || 0
    const troubleshootingCost = parseFloat(workOrder.troubleshooting_fee?.toString() || '0') || 0
    
    const laborCost = laborHours * laborRate
    const total = laborCost + partsCost + troubleshootingCost
    
    return isNaN(total) ? 0 : total
  }

  const totalRevenue = workOrders
    .filter(w => w.status === 'completed')
    .reduce((sum, w) => {
      const cost = calculateWorkOrderCost(w)
      return sum + (Number(cost) || 0)
    }, 0)

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading work orders...</span>
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
            <Button onClick={fetchWorkOrders}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
            <p className="text-muted-foreground">
              Manage repair work orders and track technician progress
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
              <div className="text-2xl font-bold">{pendingWorkOrders.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting start</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Wrench className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressWorkOrders.length}</div>
              <p className="text-xs text-muted-foreground">Being worked on</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedWorkOrders.length}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">Completed orders</p>
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

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Column Visibility */}
                <ColumnVisibilityDropdown
                  columns={WORK_ORDER_COLUMNS}
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
                  {isColumnVisible('cost') && <TableHead>Cost</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((workOrder, index) => (
                  <TableRow 
                    key={`workorder-${workOrder.id}-${index}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/work-orders/${workOrder.id}`)}
                  >
                    {isColumnVisible('work_order_number') && (
                      <TableCell className="font-medium">
                        {workOrder.formatted_number || workOrder.work_order_number || `#${workOrder.id}`}
                      </TableCell>
                    )}
                    {isColumnVisible('customer') && (
                      <TableCell>{workOrder.customer_name || 'N/A'}</TableCell>
                    )}
                    {isColumnVisible('machine') && (
                      <TableCell>
                        <div>
                          <div className="font-medium">{workOrder.machine_name || 'N/A'}</div>
                          {workOrder.model_name && (
                            <div className="text-sm text-muted-foreground">
                              {workOrder.model_name}
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
                    {isColumnVisible('cost') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {(() => {
                          const cost = calculateWorkOrderCost(workOrder)
                          return cost > 0 ? formatCurrency(cost) : 'N/A'
                        })()}
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
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} work orders
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
          title="Delete Work Order"
          itemName={workOrderToDelete?.formatted_number || workOrderToDelete?.work_order_number || `#${workOrderToDelete?.id}`}
          itemType="work order"
        />

        {/* Completed Work Order Alert Dialog */}
        <CompletedItemAlertDialog
          open={completedAlertOpen}
          onOpenChange={setCompletedAlertOpen}
          itemName={completedWorkOrder?.formatted_number || completedWorkOrder?.work_order_number || `#${completedWorkOrder?.id}`}
          itemType="work order"
          title="Cannot Delete Completed Work Order"
        />
      </div>
    </MainLayout>
  )
}