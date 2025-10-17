import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setError(t('inventory_detail_failed_to_load'))
      console.error('Error fetching inventory details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStockStatus = (quantity: number, minStockLevel?: number) => {
    const minLevel = minStockLevel || 5
    if (quantity === 0) {
      return <Badge variant="destructive">{t('inventory_out_of_stock')}</Badge>
    } else if (quantity <= minLevel) {
      return <Badge variant="outline" className="border-orange-300 text-orange-700">{t('inventory_low_stock')}</Badge>
    } else {
      return <Badge variant="outline" className="border-green-300 text-green-700">{t('inventory_in_stock')}</Badge>
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
              {t('inventory_detail_adjust_stock')}
            </Button>
            <Button variant="outline" onClick={handleEditItem}>
              <Edit className="mr-2 h-4 w-4" />
              {t('inventory_detail_edit_item')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteItem}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('inventory_detail_delete_item')}
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('inventory_detail_current_stock')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryItem.quantity}</div>
              <p className="text-xs text-muted-foreground">{t('inventory_detail_units_available')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('inventory_detail_stock_value')}</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStockValue.toFixed(2)} KM</div>
              <p className="text-xs text-muted-foreground">{t('inventory_detail_current_value')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('inventory_detail_total_used')}</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQuantityUsed}</div>
              <p className="text-xs text-muted-foreground">{t('inventory_detail_units_consumed')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('inventory_detail_work_orders')}</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground">{t('inventory_detail_regular_repairs')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('inventory_detail_warranty_repairs')}</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWarrantyWorkOrders}</div>
              <p className="text-xs text-muted-foreground">{t('inventory_detail_warranty_repairs')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alert */}
        {inventoryItem.quantity <= (inventoryItem.min_stock_level || 5) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('inventory_detail_low_stock_alert')}</AlertTitle>
            <AlertDescription>
              {t('inventory_detail_low_stock_description', { 
                current: inventoryItem.quantity, 
                minimum: inventoryItem.min_stock_level || 5 
              })}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">{t('inventory_detail_item_details')}</TabsTrigger>
            <TabsTrigger value="work-orders">{t('inventory_detail_work_orders')} ({workOrders.length})</TabsTrigger>
            <TabsTrigger value="warranty-work-orders">{t('inventory_detail_warranty_work_orders')} ({warrantyWorkOrders.length})</TabsTrigger>
            <TabsTrigger value="usage-stats">{t('inventory_detail_usage_statistics')}</TabsTrigger>
          </TabsList>

          {/* Item Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('inventory_detail_basic_information')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_name')}</p>
                      <p className="text-sm">{inventoryItem.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_sku')}</p>
                      <p className="text-sm">{inventoryItem.sku || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_part_number')}</p>
                      <p className="text-sm">{inventoryItem.part_number || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_barcode')}</p>
                      <p className="text-sm">{inventoryItem.barcode || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_category')}</p>
                      <p className="text-sm">{inventoryItem.category || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_location')}</p>
                      <p className="text-sm">{inventoryItem.location || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_created')}</p>
                      <p className="text-sm">{formatDate(inventoryItem.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_last_updated')}</p>
                      <p className="text-sm">{formatDate(inventoryItem.updated_at)}</p>
                    </div>
                  </div>
                  {inventoryItem.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_description')}</p>
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
                    {t('inventory_detail_stock_pricing')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_current_quantity')}</p>
                      <p className="text-sm font-bold">{inventoryItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_unit_price')}</p>
                      <p className="text-sm font-bold">{parseFloat(inventoryItem.unit_price.toString()).toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_min_stock_level')}</p>
                      <p className="text-sm">{inventoryItem.min_stock_level || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_reorder_level')}</p>
                      <p className="text-sm">{inventoryItem.reorder_level || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_min_order_qty')}</p>
                      <p className="text-sm">{inventoryItem.min_order_quantity || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_lead_time')}</p>
                      <p className="text-sm">{inventoryItem.lead_time_days ? `${inventoryItem.lead_time_days} ${t('inventory_detail_days')}` : t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_supplier')}</p>
                      <p className="text-sm">{inventoryItem.supplier || t('inventory_detail_not_available')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_total_value')}</p>
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
                  {t('inventory_detail_work_orders_using_item', { count: workOrders.length })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('inventory_detail_no_work_orders')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('inventory_detail_work_order')}</TableHead>
                        <TableHead>{t('inventory_detail_status')}</TableHead>
                        <TableHead>{t('inventory_detail_priority')}</TableHead>
                        <TableHead>{t('inventory_detail_customer')}</TableHead>
                        <TableHead>{t('inventory_detail_machine')}</TableHead>
                        <TableHead>{t('inventory_detail_technician')}</TableHead>
                        <TableHead>{t('inventory_detail_quantity_used')}</TableHead>
                        <TableHead>{t('inventory_detail_created')}</TableHead>
                        <TableHead className="text-right">{t('inventory_detail_actions')}</TableHead>
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
                          <TableCell>{workOrder.technician_name || t('inventory_detail_unassigned')}</TableCell>
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
                                <DropdownMenuLabel>{t('inventory_detail_actions')}</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> {t('inventory_detail_view_work_order')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/customers/${workOrder.customer_id}`)}>
                                  <User className="mr-2 h-4 w-4" /> {t('inventory_detail_view_customer')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${workOrder.machine_id}`)}>
                                  <Wrench className="mr-2 h-4 w-4" /> {t('inventory_detail_view_machine')}
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
                  {t('inventory_detail_warranty_work_orders_using_item', { count: warrantyWorkOrders.length })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warrantyWorkOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('inventory_detail_no_warranty_work_orders')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('inventory_detail_work_order')}</TableHead>
                        <TableHead>{t('inventory_detail_status')}</TableHead>
                        <TableHead>{t('inventory_detail_priority')}</TableHead>
                        <TableHead>{t('inventory_detail_customer')}</TableHead>
                        <TableHead>{t('inventory_detail_machine')}</TableHead>
                        <TableHead>{t('inventory_detail_technician')}</TableHead>
                        <TableHead>{t('inventory_detail_quantity_used')}</TableHead>
                        <TableHead>{t('inventory_detail_created')}</TableHead>
                        <TableHead className="text-right">{t('inventory_detail_actions')}</TableHead>
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
                          <TableCell>{workOrder.technician_name || t('inventory_detail_unassigned')}</TableCell>
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
                                <DropdownMenuLabel>{t('inventory_detail_actions')}</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> {t('inventory_detail_view_work_order')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/customers/${workOrder.customer_id}`)}>
                                  <User className="mr-2 h-4 w-4" /> {t('inventory_detail_view_customer')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${workOrder.machine_id}`)}>
                                  <Wrench className="mr-2 h-4 w-4" /> {t('inventory_detail_view_machine')}
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
                    {t('inventory_detail_usage_summary')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_total_units_used')}</p>
                      <p className="text-2xl font-bold">{totalQuantityUsed}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_total_value_used')}</p>
                      <p className="text-2xl font-bold">{totalValueUsed.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_regular_work_orders')}</p>
                      <p className="text-2xl font-bold">{totalWorkOrders}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_warranty_work_orders')}</p>
                      <p className="text-2xl font-bold">{totalWarrantyWorkOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('inventory_detail_stock_analysis')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_current_stock')}</p>
                      <p className="text-2xl font-bold">{inventoryItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_stock_value')}</p>
                      <p className="text-2xl font-bold">{currentStockValue.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_min_stock_level')}</p>
                      <p className="text-2xl font-bold">{inventoryItem.min_stock_level || 5}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('inventory_detail_reorder_level')}</p>
                      <p className="text-2xl font-bold">{inventoryItem.reorder_level || t('inventory_detail_not_available')}</p>
                    </div>
                  </div>
                  {inventoryItem.quantity <= (inventoryItem.min_stock_level || 5) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('inventory_detail_reorder_required')}</AlertTitle>
                      <AlertDescription>
                        {t('inventory_detail_reorder_description')}
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
              <DialogTitle>{t('inventory_edit_inventory_item')}</DialogTitle>
              <DialogDescription>
                {t('inventory_update_details_for', { name: inventoryItem?.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('inventory_item_name')} *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">{t('inventory_detail_sku')}</Label>
                <Input
                  id="edit-sku"
                  value={editFormData.sku}
                  onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-description">{t('inventory_detail_description')}</Label>
                <Input
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">{t('inventory_quantity')} *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit-price">{t('inventory_unit_price_km')} *</Label>
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
                <Label htmlFor="edit-category">{t('inventory_detail_category')}</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">{t('inventory_detail_supplier')}</Label>
                <Input
                  id="edit-supplier"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">{t('inventory_detail_location')}</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-min-stock">{t('inventory_minimum_stock_level')}</Label>
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
                {t('cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('inventory_saving')}
                  </>
                ) : (
                  t('inventory_save_changes')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('inventory_detail_adjust_stock')}</DialogTitle>
              <DialogDescription>
                {t('inventory_detail_update_stock_level_for', { name: inventoryItem?.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-stock">{t('inventory_detail_current_stock')}</Label>
                <Input
                  id="current-stock"
                  value={inventoryItem?.quantity || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-quantity">{t('inventory_detail_new_quantity')} *</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-reason">{t('inventory_detail_reason')}</Label>
                <Select 
                  value={stockAdjustment.reason} 
                  onValueChange={(value) => setStockAdjustment({ ...stockAdjustment, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">{t('inventory_stock_adjustment')}</SelectItem>
                    <SelectItem value="restock">{t('inventory_restocking')}</SelectItem>
                    <SelectItem value="damage">{t('inventory_damaged_items')}</SelectItem>
                    <SelectItem value="lost">{t('inventory_lost_items')}</SelectItem>
                    <SelectItem value="correction">{t('inventory_inventory_correction')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustStockDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSaveStockAdjustment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('inventory_adjusting')}
                  </>
                ) : (
                  t('inventory_detail_adjust_stock')
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
          title={t('inventory_delete_inventory_item')}
          description={t('inventory_delete_confirmation', { name: inventoryItem?.name })}
          isLoading={isSubmitting}
        />

        {/* Inventory In Use Alert Dialog */}
        <InventoryInUseAlertDialog
          open={inUseAlertOpen}
          onOpenChange={setInUseAlertOpen}
          itemName={inventoryItem?.name}
          workOrderCount={workOrderCount}
          title={t('inventory_cannot_delete_item')}
        />
      </div>
    </MainLayout>
  )
}
