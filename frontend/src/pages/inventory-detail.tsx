import { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
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
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Building,
  Euro,
  Clock,
  Award,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  User,
  Wrench,
  BarChart3,
  ShoppingCart,
  AlertCircle
} from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { formatDate } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { InventoryInUseAlertDialog } from '../components/ui/inventory-in-use-alert-dialog'
import { toast } from 'sonner'

interface InventoryItem {
  id: string
  name: string
  description?: string
  quantity: number
  unit_price: number
  category?: string
  min_stock_level?: number
  supplier?: string
  sku?: string
  location?: string
  part_number?: string
  barcode?: string
  reorder_level?: number
  min_order_quantity?: number
  lead_time_days?: number
  created_at: string
  updated_at: string
}

interface WorkOrder {
  id: string
  machine_id: string
  customer_id: string
  description?: string
  status: string
  technician_id?: string
  priority: string
  ticket_number?: string
  formatted_number?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  total_cost?: number
  is_warranty: boolean
  labor_hours?: number
  labor_rate?: number
  quote_subtotal_parts?: number
  quote_total?: number
  approval_status?: string
  approval_at?: string
  troubleshooting_fee?: number
  paid_at?: string
  converted_from_ticket_id?: string
  owner_technician_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  machine_name: string
  serial_number: string
  technician_name?: string
  owner_technician_name?: string
  quantity_used: number
}

interface WarrantyWorkOrder {
  id: string
  machine_id: string
  customer_id: string
  description?: string
  status: string
  technician_id?: string
  priority: string
  ticket_number?: string
  formatted_number?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  labor_hours?: number
  labor_rate?: number
  troubleshooting_fee?: number
  quote_subtotal_parts?: number
  quote_total?: number
  converted_from_ticket_id?: string
  owner_technician_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  machine_name: string
  serial_number: string
  technician_name?: string
  owner_technician_name?: string
  quantity_used: number
}

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [warrantyWorkOrders, setWarrantyWorkOrders] = useState<WarrantyWorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Edit/Delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [inUseAlertOpen, setInUseAlertOpen] = useState(false)
  const [workOrderCount, setWorkOrderCount] = useState(0)
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    quantity: '',
    unit_price: '',
    category: '',
    supplier: '',
    sku: '',
    location: '',
    min_stock_level: ''
  })
  const [stockAdjustment, setStockAdjustment] = useState({
    quantity: '',
    reason: 'adjustment'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchInventoryDetails()
    }
  }, [id])

  const fetchInventoryDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch inventory item details
      const inventoryResponse = await apiService.getInventoryItem(id!) as any
      setInventoryItem(inventoryResponse.data)

      // Fetch work orders that use this inventory item
      const workOrdersResponse = await apiService.getInventoryWorkOrders(id!) as any
      setWorkOrders(workOrdersResponse.data || [])

      // Fetch warranty work orders that use this inventory item
      const warrantyWorkOrdersResponse = await apiService.getInventoryWarrantyWorkOrders(id!) as any
      setWarrantyWorkOrders(warrantyWorkOrdersResponse.data || [])
    } catch (err) {
      setError('Failed to load inventory item details.')
      console.error('Error fetching inventory details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStockStatus = (quantity: number, minStockLevel?: number) => {
    const minLevel = minStockLevel || 5
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (quantity <= minLevel) {
      return <Badge variant="outline" className="border-orange-300 text-orange-700">Low Stock</Badge>
    } else {
      return <Badge variant="outline" className="border-green-300 text-green-700">In Stock</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      pending: Clock,
      in_progress: Activity,
      completed: CheckCircle,
      cancelled: XCircle,
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
      low: { color: 'default' as const },
      medium: { color: 'outline' as const },
      high: { color: 'destructive' as const },
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant={config.color}>
        {priority}
      </Badge>
    )
  }

  const handleEditItem = () => {
    if (!inventoryItem) return
    
    setEditFormData({
      name: inventoryItem.name,
      description: inventoryItem.description || '',
      quantity: inventoryItem.quantity.toString(),
      unit_price: inventoryItem.unit_price.toString(),
      category: inventoryItem.category || '',
      supplier: inventoryItem.supplier || '',
      sku: inventoryItem.sku || '',
      location: inventoryItem.location || '',
      min_stock_level: inventoryItem.min_stock_level?.toString() || ''
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!inventoryItem) return

    setIsSubmitting(true)
    try {
      await apiService.updateInventoryItem(inventoryItem.id, {
        name: editFormData.name,
        description: editFormData.description || null,
        quantity: parseInt(editFormData.quantity),
        unit_price: parseFloat(editFormData.unit_price),
        category: editFormData.category || null,
        supplier: editFormData.supplier || null,
        sku: editFormData.sku || null,
        location: editFormData.location || null,
        min_stock_level: editFormData.min_stock_level ? parseInt(editFormData.min_stock_level) : null
      })
      
      toast.success('Inventory item updated successfully')
      setEditDialogOpen(false)
      fetchInventoryDetails()
    } catch (err: any) {
      console.error('Error updating item:', err)
      toast.error(err.response?.data?.message || 'Failed to update item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdjustStock = () => {
    if (!inventoryItem) return
    
    setStockAdjustment({
      quantity: inventoryItem.quantity.toString(),
      reason: 'adjustment'
    })
    setAdjustStockDialogOpen(true)
  }

  const handleSaveStockAdjustment = async () => {
    if (!inventoryItem) return

    setIsSubmitting(true)
    try {
      await apiService.updateInventoryItem(inventoryItem.id, {
        quantity: parseInt(stockAdjustment.quantity)
      })
      
      toast.success('Stock adjusted successfully')
      setAdjustStockDialogOpen(false)
      fetchInventoryDetails()
    } catch (err: any) {
      console.error('Error adjusting stock:', err)
      toast.error(err.response?.data?.message || 'Failed to adjust stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteItem = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDeleteItem = async () => {
    if (!inventoryItem) return

    setIsSubmitting(true)
    try {
      await apiService.deleteInventoryItem(inventoryItem.id)
      toast.success('Inventory item deleted successfully')
      navigate('/inventory')
    } catch (err: any) {
      console.error('Error deleting item:', err)
      
      // Check if it's a "item in use" error
      if (err.response?.data?.message?.includes('currently used in') && err.response?.data?.message?.includes('work order')) {
        // Extract the count from the error message
        const message = err.response.data.message
        const countMatch = message.match(/used in (\d+) work order/)
        const count = countMatch ? parseInt(countMatch[1]) : 0
        
        setWorkOrderCount(count)
        setInUseAlertOpen(true)
        setDeleteDialogOpen(false)
      } else {
        toast.error(err.response?.data?.message || 'Failed to delete item')
      }
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading inventory details...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  if (!inventoryItem) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Inventory item not found.</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  // Calculate statistics
  const totalWorkOrders = workOrders.length
  const totalWarrantyWorkOrders = warrantyWorkOrders.length
  const totalQuantityUsed = workOrders.reduce((sum, wo) => sum + (wo.quantity_used || 0), 0) + 
                           warrantyWorkOrders.reduce((sum, wwo) => sum + (wwo.quantity_used || 0), 0)
  const totalValueUsed = totalQuantityUsed * parseFloat(inventoryItem.unit_price.toString())
  const currentStockValue = inventoryItem.quantity * parseFloat(inventoryItem.unit_price.toString())

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{inventoryItem.name}</h1>
              <div className="text-muted-foreground flex items-center gap-2">
                {inventoryItem.sku && <span>SKU: {inventoryItem.sku}</span>}
                {inventoryItem.sku && inventoryItem.category && <span>•</span>}
                {inventoryItem.category && <span>{inventoryItem.category}</span>}
                {(inventoryItem.sku || inventoryItem.category) && <span>•</span>}
                {getStockStatus(inventoryItem.quantity, inventoryItem.min_stock_level)}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleAdjustStock}>
              <Package className="mr-2 h-4 w-4" />
              Adjust Stock
            </Button>
            <Button variant="outline" onClick={handleEditItem}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Button>
            <Button variant="destructive" onClick={handleDeleteItem}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Item
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryItem.quantity}</div>
              <p className="text-xs text-muted-foreground">Units available</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStockValue.toFixed(2)} KM</div>
              <p className="text-xs text-muted-foreground">Current value</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Used</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQuantityUsed}</div>
              <p className="text-xs text-muted-foreground">Units consumed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Work Orders</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground">Regular repairs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warranty Repairs</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWarrantyWorkOrders}</div>
              <p className="text-xs text-muted-foreground">Warranty repairs</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alert */}
        {inventoryItem.quantity <= (inventoryItem.min_stock_level || 5) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Stock Alert</AlertTitle>
            <AlertDescription>
              This item is running low on stock. Current quantity: {inventoryItem.quantity}, 
              Minimum level: {inventoryItem.min_stock_level || 5}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Item Details</TabsTrigger>
            <TabsTrigger value="work-orders">Work Orders ({workOrders.length})</TabsTrigger>
            <TabsTrigger value="warranty-work-orders">Warranty Work Orders ({warrantyWorkOrders.length})</TabsTrigger>
            <TabsTrigger value="usage-stats">Usage Statistics</TabsTrigger>
          </TabsList>

          {/* Item Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Name</p>
                      <p className="text-sm">{inventoryItem.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">SKU</p>
                      <p className="text-sm">{inventoryItem.sku || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Part Number</p>
                      <p className="text-sm">{inventoryItem.part_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Barcode</p>
                      <p className="text-sm">{inventoryItem.barcode || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Category</p>
                      <p className="text-sm">{inventoryItem.category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="text-sm">{inventoryItem.location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created</p>
                      <p className="text-sm">{formatDate(inventoryItem.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="text-sm">{formatDate(inventoryItem.updated_at)}</p>
                    </div>
                  </div>
                  {inventoryItem.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="text-sm">{inventoryItem.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stock & Pricing Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Stock & Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Quantity</p>
                      <p className="text-sm font-bold">{inventoryItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unit Price</p>
                      <p className="text-sm font-bold">{parseFloat(inventoryItem.unit_price.toString()).toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Min Stock Level</p>
                      <p className="text-sm">{inventoryItem.min_stock_level || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reorder Level</p>
                      <p className="text-sm">{inventoryItem.reorder_level || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Min Order Qty</p>
                      <p className="text-sm">{inventoryItem.min_order_quantity || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Lead Time</p>
                      <p className="text-sm">{inventoryItem.lead_time_days ? `${inventoryItem.lead_time_days} days` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                      <p className="text-sm">{inventoryItem.supplier || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                      <p className="text-sm font-bold">{currentStockValue.toFixed(2)} KM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Work Orders Tab */}
          <TabsContent value="work-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Work Orders Using This Item ({workOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">This item has not been used in any work orders.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Machine</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Quantity Used</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workOrders.map((workOrder) => (
                        <TableRow key={workOrder.id}>
                          <TableCell className="font-medium">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto"
                              onClick={() => navigate(`/work-orders/${workOrder.id}`)}
                            >
                              #{workOrder.formatted_number || workOrder.id}
                            </Button>
                          </TableCell>
                          <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                          <TableCell>{getPriorityBadge(workOrder.priority)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/customers/${workOrder.customer_id}`)}
                            >
                              {workOrder.customer_name}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/machines/${workOrder.machine_id}`)}
                            >
                              {workOrder.serial_number}
                            </Button>
                          </TableCell>
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell className="font-medium">{workOrder.quantity_used}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Work Order
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/customers/${workOrder.customer_id}`)}>
                                  <User className="mr-2 h-4 w-4" /> View Customer
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${workOrder.machine_id}`)}>
                                  <Wrench className="mr-2 h-4 w-4" /> View Machine
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warranty Work Orders Tab */}
          <TabsContent value="warranty-work-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Warranty Work Orders Using This Item ({warrantyWorkOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warrantyWorkOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">This item has not been used in any warranty work orders.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Machine</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Quantity Used</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warrantyWorkOrders.map((workOrder) => (
                        <TableRow key={workOrder.id}>
                          <TableCell className="font-medium">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto"
                              onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}
                            >
                              #{workOrder.formatted_number || workOrder.id}
                            </Button>
                          </TableCell>
                          <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                          <TableCell>{getPriorityBadge(workOrder.priority)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/customers/${workOrder.customer_id}`)}
                            >
                              {workOrder.customer_name}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/machines/${workOrder.machine_id}`)}
                            >
                              {workOrder.serial_number}
                            </Button>
                          </TableCell>
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell className="font-medium">{workOrder.quantity_used}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Work Order
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/customers/${workOrder.customer_id}`)}>
                                  <User className="mr-2 h-4 w-4" /> View Customer
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${workOrder.machine_id}`)}>
                                  <Wrench className="mr-2 h-4 w-4" /> View Machine
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Statistics Tab */}
          <TabsContent value="usage-stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Usage Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Units Used</p>
                      <p className="text-2xl font-bold">{totalQuantityUsed}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Value Used</p>
                      <p className="text-2xl font-bold">{totalValueUsed.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Regular Work Orders</p>
                      <p className="text-2xl font-bold">{totalWorkOrders}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Warranty Work Orders</p>
                      <p className="text-2xl font-bold">{totalWarrantyWorkOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Stock Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Stock</p>
                      <p className="text-2xl font-bold">{inventoryItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
                      <p className="text-2xl font-bold">{currentStockValue.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Min Stock Level</p>
                      <p className="text-2xl font-bold">{inventoryItem.min_stock_level || 5}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reorder Level</p>
                      <p className="text-2xl font-bold">{inventoryItem.reorder_level || 'N/A'}</p>
                    </div>
                  </div>
                  {inventoryItem.quantity <= (inventoryItem.min_stock_level || 5) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Reorder Required</AlertTitle>
                      <AlertDescription>
                        Stock is below minimum level. Consider reordering.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Item Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
              <DialogDescription>
                Update the details for {inventoryItem?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU</Label>
                <Input
                  id="edit-sku"
                  value={editFormData.sku}
                  onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit-price">Unit Price (KM) *</Label>
                <Input
                  id="edit-unit-price"
                  type="number"
                  step="0.01"
                  value={editFormData.unit_price}
                  onChange={(e) => setEditFormData({ ...editFormData, unit_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Supplier</Label>
                <Input
                  id="edit-supplier"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-min-stock">Minimum Stock Level</Label>
                <Input
                  id="edit-min-stock"
                  type="number"
                  value={editFormData.min_stock_level}
                  onChange={(e) => setEditFormData({ ...editFormData, min_stock_level: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                Update stock level for {inventoryItem?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-stock">Current Stock</Label>
                <Input
                  id="current-stock"
                  value={inventoryItem?.quantity || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-quantity">New Quantity *</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-reason">Reason</Label>
                <Select 
                  value={stockAdjustment.reason} 
                  onValueChange={(value) => setStockAdjustment({ ...stockAdjustment, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                    <SelectItem value="restock">Restocking</SelectItem>
                    <SelectItem value="damage">Damaged Items</SelectItem>
                    <SelectItem value="lost">Lost Items</SelectItem>
                    <SelectItem value="correction">Inventory Correction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustStockDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStockAdjustment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adjusting...
                  </>
                ) : (
                  'Adjust Stock'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteItem}
          title="Delete Inventory Item"
          description={`Are you sure you want to delete ${inventoryItem?.name}? This action cannot be undone.`}
          isLoading={isSubmitting}
        />

        {/* Inventory In Use Alert Dialog */}
        <InventoryInUseAlertDialog
          open={inUseAlertOpen}
          onOpenChange={setInUseAlertOpen}
          itemName={inventoryItem?.name}
          workOrderCount={workOrderCount}
          title="Cannot Delete Inventory Item"
        />
      </div>
    </MainLayout>
  )
}
